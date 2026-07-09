import { Purchase, PurchaseCategory, User } from '@prisma/client';

export type PurchaseDetail = Purchase & { responsible: User };

export interface CreatePurchaseData {
  eventId: string;
  date: Date;
  description: string;
  category: PurchaseCategory;
  amountCents: number;
  responsibleId: string;
}

export interface UpdatePurchaseData {
  date?: Date;
  description?: string;
  category?: PurchaseCategory;
  amountCents?: number;
  responsibleId?: string;
  receiptPath?: string;
}

export interface ListPurchasesFilter {
  eventId?: string;
  category?: PurchaseCategory;
}

export abstract class PurchaseRepository {
  abstract findById(id: string): Promise<PurchaseDetail | null>;
  abstract create(data: CreatePurchaseData): Promise<PurchaseDetail>;
  abstract update(
    id: string,
    data: UpdatePurchaseData,
  ): Promise<PurchaseDetail>;
  abstract delete(id: string): Promise<void>;
  abstract list(filter: ListPurchasesFilter): Promise<PurchaseDetail[]>;
}
