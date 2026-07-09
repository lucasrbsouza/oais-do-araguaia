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
  MinLength,
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

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description!: string;

  @ApiProperty({ enum: PurchaseCategory })
  @IsEnum(PurchaseCategory)
  category!: PurchaseCategory;

  @ApiProperty({ description: 'Valor em centavos.' })
  @IsInt()
  @Min(1)
  amountCents!: number;
}

class UpdatePurchaseDto {
  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ enum: PurchaseCategory })
  @IsOptional()
  @IsEnum(PurchaseCategory)
  category?: PurchaseCategory;

  @ApiPropertyOptional({ description: 'Valor em centavos.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;
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
    return this.createPurchase.execute({ ...dto, responsibleId: user.id });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseDto,
  ): Promise<PurchaseResponse> {
    return this.updatePurchase.execute({ id, ...dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.deletePurchase.execute(id);
  }

  @Post(':id/receipt')
  @UseInterceptors(FileInterceptor('file'))
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
  ): Promise<PurchaseResponse> {
    return this.attachReceipt.execute(id, file.buffer, file.originalname);
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
