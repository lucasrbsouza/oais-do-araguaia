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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CurrentUser,
  Roles,
} from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import { ReservationResponse } from '../application/reservation.mapper';
import {
  CancelReservationUseCase,
  CreateReservationUseCase,
  DeleteReservationUseCase,
  ListReservationsUseCase,
  UpdateReservationUseCase,
} from '../application/use-cases/manage-reservation.use-cases';

class CreateReservationDto {
  @ApiProperty()
  @IsUUID()
  eventId!: string;

  @ApiProperty()
  @IsUUID()
  chaletId!: string;

  @ApiPropertyOptional({
    description: 'Somente admin pode indicar outro responsável.',
  })
  @IsOptional()
  @IsUUID()
  responsibleId?: string;

  @ApiProperty({ type: Date })
  @Type(() => Date)
  @IsDate()
  checkIn!: Date;

  @ApiProperty({ type: Date })
  @Type(() => Date)
  @IsDate()
  checkOut!: Date;

  @ApiProperty({ description: 'Hóspedes com 8 anos ou mais.' })
  @IsInt()
  @Min(0)
  adults!: number;

  @ApiProperty({ description: 'Hóspedes com menos de 8 anos.' })
  @IsInt()
  @Min(0)
  children!: number;

  @ApiProperty({
    description:
      'Pessoas que consomem bebidas alcoólicas (hóspedes ou visitantes).',
  })
  @IsInt()
  @Min(0)
  alcoholConsumers!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

class UpdateReservationDto {
  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkIn?: Date;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  checkOut?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  adults?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  alcoholConsumers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

class ListReservationsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  chaletId?: string;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: Date })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly createReservation: CreateReservationUseCase,
    private readonly updateReservation: UpdateReservationUseCase,
    private readonly cancelReservation: CancelReservationUseCase,
    private readonly deleteReservation: DeleteReservationUseCase,
    private readonly listReservations: ListReservationsUseCase,
  ) {}

  @Get()
  list(@Query() query: ListReservationsQuery): Promise<ReservationResponse[]> {
    return this.listReservations.execute(query);
  }

  @Post()
  create(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationResponse> {
    return this.createReservation.execute(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationResponse> {
    return this.updateReservation.execute({ id, ...dto }, user);
  }

  @Post(':id/cancel')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReservationResponse> {
    return this.cancelReservation.execute(id, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.deleteReservation.execute(id);
  }
}
