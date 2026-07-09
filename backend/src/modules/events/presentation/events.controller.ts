import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Event, EventStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CurrentUser,
  Roles,
} from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import { PaginatedEvents } from '../domain/event.repository';
import {
  CloseEventUseCase,
  CreateEventUseCase,
  GetEventUseCase,
  ListEventsUseCase,
  ReopenEventUseCase,
} from '../application/use-cases/manage-event.use-cases';

class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: Date })
  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @ApiProperty({ type: Date })
  @Type(() => Date)
  @IsDate()
  endDate!: Date;
}

class ListEventsQuery {
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

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 20;
}

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(
    private readonly createEvent: CreateEventUseCase,
    private readonly listEvents: ListEventsUseCase,
    private readonly getEvent: GetEventUseCase,
    private readonly closeEvent: CloseEventUseCase,
    private readonly reopenEvent: ReopenEventUseCase,
  ) {}

  @Get()
  list(@Query() query: ListEventsQuery): Promise<PaginatedEvents> {
    return this.listEvents.execute(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Event> {
    return this.getEvent.execute(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateEventDto): Promise<Event> {
    return this.createEvent.execute(dto);
  }

  @Post(':id/close')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Event> {
    return this.closeEvent.execute(id, user.id);
  }

  @Post(':id/reopen')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Event> {
    return this.reopenEvent.execute(id, user.id);
  }
}
