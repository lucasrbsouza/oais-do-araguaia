import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { PurchaseCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import {
  AttachReceiptUseCase,
  CreatePurchaseUseCase,
  DeletePurchaseUseCase,
  GetReceiptUseCase,
  ListPurchasesUseCase,
  PurchaseResponse,
  UpdatePurchaseUseCase,
} from '../application/use-cases/manage-purchase.use-cases';

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_MIME_PATTERN = /^(image\/(jpeg|png|webp)|application\/pdf)$/;

class CreatePurchaseDto {
  @ApiProperty()
  @IsUUID()
  eventId!: string;

  @ApiProperty({ type: Date })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ enum: PurchaseCategory })
  @IsEnum(PurchaseCategory)
  category!: PurchaseCategory;

  @ApiProperty({ description: 'Valor em centavos.' })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional({
    description: 'Chalé beneficiado (adiantamento vinculado à reserva).',
  })
  @IsOptional()
  @IsUUID()
  chaletId?: string;
}

class UpdatePurchaseDto {
  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @ApiPropertyOptional({ enum: PurchaseCategory })
  @IsOptional()
  @IsEnum(PurchaseCategory)
  category?: PurchaseCategory;

  @ApiPropertyOptional({ description: 'Valor em centavos.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;

  @ApiPropertyOptional({
    description:
      'Chalé beneficiado (adiantamento). Envie null para desvincular.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  chaletId?: string | null;
}

class ListPurchasesQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ enum: PurchaseCategory })
  @IsOptional()
  @IsEnum(PurchaseCategory)
  category?: PurchaseCategory;
}

@ApiTags('purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly createPurchase: CreatePurchaseUseCase,
    private readonly updatePurchase: UpdatePurchaseUseCase,
    private readonly deletePurchase: DeletePurchaseUseCase,
    private readonly listPurchases: ListPurchasesUseCase,
    private readonly attachReceipt: AttachReceiptUseCase,
    private readonly getReceipt: GetReceiptUseCase,
  ) {}

  @Get()
  list(@Query() query: ListPurchasesQuery): Promise<PurchaseResponse[]> {
    return this.listPurchases.execute(query);
  }

  @Post()
  create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PurchaseResponse> {
    return this.createPurchase.execute(
      { ...dto, responsibleId: user.id },
      user,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PurchaseResponse> {
    return this.updatePurchase.execute({ id, ...dto }, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.deletePurchase.execute(id, user);
  }

  @Post(':id/receipt')
  // Corta no streaming. O MaxFileSizeValidator abaixo só olha o tamanho depois
  // que o multer já bufferizou o arquivo inteiro na memória.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_RECEIPT_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_RECEIPT_BYTES }),
          new FileTypeValidator({ fileType: RECEIPT_MIME_PATTERN }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PurchaseResponse> {
    return this.attachReceipt.execute(id, file.buffer, file.originalname, user);
  }

  @Get(':id/receipt')
  async downloadReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const filePath = await this.getReceipt.execute(id);
    res.sendFile(filePath);
  }
}
