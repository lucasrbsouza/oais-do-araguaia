import { Chalet, ChaletStatus, User } from '@prisma/client';

export type ChaletMemberDetail = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
};

export type ChaletWithOwner = Chalet & {
  owner: User | null;
  members?: Array<{ user: { id: string; name: string } }>;
};

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
  abstract findAccessibleByUser(userId: string): Promise<Chalet[]>;
  abstract isOwnerOrMember(userId: string, chaletId: string): Promise<boolean>;
  abstract listMembers(chaletId: string): Promise<ChaletMemberDetail[]>;
  abstract addMember(chaletId: string, userId: string): Promise<void>;
  abstract removeMember(chaletId: string, userId: string): Promise<void>;
  abstract isMemberOfAnyChalet(userId: string): Promise<boolean>;
  abstract countMembers(chaletId: string): Promise<number>;
  abstract hasHistory(id: string): Promise<boolean>;
  abstract delete(id: string): Promise<void>;
}
