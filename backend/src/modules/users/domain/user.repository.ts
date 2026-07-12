import { Role, User } from '@prisma/client';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  phone?: string | null;
  mustChangePassword?: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: Role;
  active?: boolean;
  passwordHash?: string;
  phone?: string | null;
  avatarPath?: string | null;
  mustChangePassword?: boolean;
}

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findByName(name: string): Promise<User | null>;
  abstract create(data: CreateUserData): Promise<User>;
  abstract update(id: string, data: UpdateUserData): Promise<User>;
  abstract list(): Promise<User[]>;
  abstract hasHistory(id: string): Promise<boolean>;
  abstract delete(id: string): Promise<void>;
}
