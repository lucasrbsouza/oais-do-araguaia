import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Payment } from '@prisma/client';
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
import {
  ChaletPaymentSummary,
  GetEventPaymentsUseCase,
  RegisterPaymentUseCase,
} from '../application/use-cases/manage-payment.use-cases';

class RegisterPaymentDto {
  @ApiProperty()
  @IsUUID()
  eventId!: string;

  @ApiProperty()
  @IsUUID()
  chaletId!: string;

  @ApiProperty({ type: Date })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ description: 'Valor em centavos.' })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(
    private readonly registerPayment: RegisterPaymentUseCase,
    private readonly getEventPayments: GetEventPaymentsUseCase,
  ) {}

  @Post('payments')
  @Roles('ADMIN')
  register(
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Payment> {
    return this.registerPayment.execute(dto, user.id);
  }

  @Get('events/:eventId/payments')
  byEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChaletPaymentSummary[]> {
    return this.getEventPayments.execute(eventId, user);
  }
}
