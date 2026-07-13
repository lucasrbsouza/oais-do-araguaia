import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Roles } from '../../shared/infrastructure/auth/decorators';
import { AuditService, PaginatedAuditLogs } from './audit.service';

const AUDIT_ENTITIES = [
  'Auth',
  'User',
  'Chalet',
  'Event',
  'Reservation',
  'Purchase',
  'Settlement',
  'Payment',
  'Receivable',
  'Report',
];

class ListAuditQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: AUDIT_ENTITIES })
  @IsOptional()
  @IsIn(AUDIT_ENTITIES)
  entity?: string;

  @ApiPropertyOptional({ description: 'Ação exata, ex.: PURCHASE_CREATED.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

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

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('ADMIN')
  list(@Query() query: ListAuditQuery): Promise<PaginatedAuditLogs> {
    return this.auditService.list({
      userId: query.userId,
      entity: query.entity,
      action: query.action,
      from: query.from,
      to: query.to,
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
    });
  }
}
