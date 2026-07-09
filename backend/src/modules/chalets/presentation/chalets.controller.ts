import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { ChaletStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CurrentUser,
  Roles,
} from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import { ChaletResponse } from '../application/chalet.mapper';
import {
  CreateChaletUseCase,
  DeleteChaletUseCase,
  ListChaletsUseCase,
  UpdateChaletUseCase,
} from '../application/use-cases/manage-chalet.use-cases';

class CreateChaletDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  number!: number;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

class UpdateChaletDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Somente administradores.' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ enum: ChaletStatus })
  @IsOptional()
  @IsEnum(ChaletStatus)
  status?: ChaletStatus;
}

@ApiTags('chalets')
@ApiBearerAuth()
@Controller('chalets')
export class ChaletsController {
  constructor(
    private readonly createChalet: CreateChaletUseCase,
    private readonly updateChalet: UpdateChaletUseCase,
    private readonly deleteChalet: DeleteChaletUseCase,
    private readonly listChalets: ListChaletsUseCase,
  ) {}

  @Get()
  list(): Promise<ChaletResponse[]> {
    return this.listChalets.execute();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateChaletDto): Promise<ChaletResponse> {
    return this.createChalet.execute(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChaletDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChaletResponse> {
    return this.updateChalet.execute({ id, ...dto }, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.deleteChalet.execute(id);
  }
}
