import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../shared/infrastructure/auth/decorators';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { ListUsersUseCase } from '../application/use-cases/list-users.use-case';
import { UpdateUserUseCase } from '../application/use-cases/update-user.use-case';
import { UserResponse } from '../application/user.mapper';
import { CreateUserDto, UpdateUserDto } from './users.dto';

@ApiTags('users')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
  ) {}

  @Get()
  list(): Promise<UserResponse[]> {
    return this.listUsers.execute();
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<UserResponse> {
    return this.createUser.execute(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.updateUser.execute({ id, ...dto });
  }
}
