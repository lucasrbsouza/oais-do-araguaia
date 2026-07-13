import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { SettlementAutoMode } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  CurrentUser,
  Roles,
} from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import {
  SettlementAutoConfig,
  SettlementView,
} from '../domain/settlement.repository';
import { CalculateSettlementUseCase } from '../application/use-cases/calculate-settlement.use-case';
import { GetSettlementUseCase } from '../application/use-cases/get-settlement.use-case';
import {
  GetSettlementAutoConfigUseCase,
  SetSettlementAutoConfigUseCase,
} from '../application/use-cases/manage-auto-settlement.use-cases';

class SetSettlementAutoDto {
  @ApiProperty({ enum: SettlementAutoMode })
  @IsEnum(SettlementAutoMode)
  mode!: SettlementAutoMode;

  @ApiPropertyOptional({
    description: 'Intervalo em minutos (obrigatório no modo INTERVAL).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_080)
  intervalMinutes?: number;
}

@ApiTags('settlement')
@ApiBearerAuth()
@Controller('events/:eventId/settlement')
export class SettlementController {
  constructor(
    private readonly calculateSettlement: CalculateSettlementUseCase,
    private readonly getSettlement: GetSettlementUseCase,
    private readonly getAutoConfig: GetSettlementAutoConfigUseCase,
    private readonly setAutoConfig: SetSettlementAutoConfigUseCase,
  ) {}

  @Post('calculate')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  calculate(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SettlementView> {
    return this.calculateSettlement.execute(eventId, user.id);
  }

  @Get()
  get(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<SettlementView> {
    return this.getSettlement.execute(eventId);
  }

  @Get('auto')
  getAuto(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<SettlementAutoConfig> {
    return this.getAutoConfig.execute(eventId);
  }

  @Put('auto')
  @Roles('ADMIN')
  setAuto(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: SetSettlementAutoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SettlementAutoConfig> {
    return this.setAutoConfig.execute(eventId, dto, user.id);
  }
}
