import { Chalet, Purchase, PurchaseCategory, User } from '@prisma/client';

export type PurchaseDetail = Purchase & {
  responsible: User;
  chalet: Chalet | null;
};

export interface CreatePurchaseData {
  eventId: string;
  date: Date;
  description?: string | null;
  category: PurchaseCategory;
  amountCents: number;
  responsibleId: string;
  chaletId?: string | null;
}

export interface UpdatePurchaseData {
  date?: Date;
  description?: string | null;
  category?: PurchaseCategory;
  amountCents?: number;
  responsibleId?: string;
  chaletId?: string | null;
  receiptPath?: string;
}

export interface ListPurchasesFilter {
  eventId?: string;
  category?: PurchaseCategory;
}

export interface ChaletAdvanceTotal {
  chaletId: string;
  totalCents: number;
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
  /** Total de compras/adiantamentos vinculados a cada chalé no evento. */
  abstract advancesByEvent(eventId: string): Promise<ChaletAdvanceTotal[]>;
}
