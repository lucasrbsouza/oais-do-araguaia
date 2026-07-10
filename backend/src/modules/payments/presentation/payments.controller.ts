import {
  Body,
  Controller,
  Get,
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
import {
  ListEventReceivablesUseCase,
  ListOpenReceivablesUseCase,
  ReceivableResponse,
  SettleReceivableUseCase,
} from '../application/use-cases/manage-receivable.use-cases';

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

class SettleReceivableDto {
  @ApiPropertyOptional({ description: 'Observação sobre a quitação.' })
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
    private readonly listEventReceivables: ListEventReceivablesUseCase,
    private readonly listOpenReceivables: ListOpenReceivablesUseCase,
    private readonly settleReceivable: SettleReceivableUseCase,
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

  @Get('events/:eventId/receivables')
  receivablesByEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReceivableResponse[]> {
    return this.listEventReceivables.execute(eventId, user);
  }

  @Get('receivables')
  openReceivables(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReceivableResponse[]> {
    return this.listOpenReceivables.execute(user);
  }

  @Patch('receivables/:id/settle')
  @Roles('ADMIN')
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleReceivableDto,
  ): Promise<ReceivableResponse> {
    return this.settleReceivable.execute(id, dto.notes);
  }
}
