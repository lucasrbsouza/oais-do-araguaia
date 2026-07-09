import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  Roles,
} from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import { SettlementView } from '../domain/settlement.repository';
import { CalculateSettlementUseCase } from '../application/use-cases/calculate-settlement.use-case';
import { GetSettlementUseCase } from '../application/use-cases/get-settlement.use-case';

@ApiTags('settlement')
@ApiBearerAuth()
@Controller('events/:eventId/settlement')
export class SettlementController {
  constructor(
    private readonly calculateSettlement: CalculateSettlementUseCase,
    private readonly getSettlement: GetSettlementUseCase,
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
}
