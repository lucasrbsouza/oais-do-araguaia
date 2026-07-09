import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/user.repository';
import { toUserResponse, UserResponse } from '../user.mapper';

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<UserResponse[]> {
    const users = await this.userRepository.list();
    return users.map(toUserResponse);
  }
}
