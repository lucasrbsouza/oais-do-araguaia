import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  Roles,
} from '../../../shared/infrastructure/auth/decorators';
import type { AuthenticatedUser } from '../../../shared/infrastructure/auth/decorators';
import { CreateUserUseCase } from '../application/use-cases/create-user.use-case';
import { DeleteUserUseCase } from '../application/use-cases/delete-user.use-case';
import { ListUsersUseCase } from '../application/use-cases/list-users.use-case';
import {
  ChangePasswordUseCase,
  GetAvatarUseCase,
  GetUserUseCase,
  SetAvatarUseCase,
  UpdateProfileUseCase,
} from '../application/use-cases/manage-profile.use-cases';
import { UpdateUserUseCase } from '../application/use-cases/update-user.use-case';
import { UserResponse } from '../application/user.mapper';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './users.dto';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_PATTERN = /^image\/(jpeg|png|webp)$/;

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly deleteUser: DeleteUserUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly setAvatar: SetAvatarUseCase,
    private readonly getAvatar: GetAvatarUseCase,
  ) {}

  @Get()
  list(): Promise<UserResponse[]> {
    return this.listUsers.execute();
  }

  // Rotas "me" declaradas antes de ":id" para não colidirem com o parâmetro.
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return this.getUser.execute(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponse> {
    return this.updateProfile.execute({ userId: user.id, ...dto });
  }

  @Post('me/password')
  changeMyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<UserResponse> {
    return this.changePassword.execute({ userId: user.id, ...dto });
  }

  @Post('me/avatar')
  // Corta no streaming. O MaxFileSizeValidator abaixo só olha o tamanho depois
  // que o multer já bufferizou o arquivo inteiro na memória.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_AVATAR_BYTES }),
          new FileTypeValidator({ fileType: AVATAR_MIME_PATTERN }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<UserResponse> {
    return this.setAvatar.execute(user.id, file.buffer, file.originalname);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponse> {
    return this.getUser.execute(id);
  }

  @Get(':id/avatar')
  async downloadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const filePath = await this.getAvatar.execute(id);
    res.sendFile(filePath);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateUserDto): Promise<UserResponse> {
    return this.createUser.execute(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.updateUser.execute({ id, ...dto });
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    return this.deleteUser.execute({ id, currentUserId: currentUser.id });
  }
}
