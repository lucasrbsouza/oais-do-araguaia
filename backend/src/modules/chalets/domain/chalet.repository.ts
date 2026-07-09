import { Chalet, ChaletStatus, User } from '@prisma/client';

export type ChaletWithOwner = Chalet & { owner: User | null };

export interface CreateChaletData {
  number: number;
  name: string;
  ownerId?: string;
}

export interface UpdateChaletData {
  name?: string;
  ownerId?: string | null;
  status?: ChaletStatus;
}

export abstract class ChaletRepository {
  abstract findById(id: string): Promise<ChaletWithOwner | null>;
  abstract findByNumber(number: number): Promise<Chalet | null>;
  abstract create(data: CreateChaletData): Promise<ChaletWithOwner>;
  abstract update(id: string, data: UpdateChaletData): Promise<ChaletWithOwner>;
  abstract list(): Promise<ChaletWithOwner[]>;
  abstract findByOwner(ownerId: string): Promise<Chalet[]>;
  abstract hasHistory(id: string): Promise<boolean>;
  abstract delete(id: string): Promise<void>;
}
