import { ChaletStatus } from '@prisma/client';
import { ChaletWithOwner } from '../domain/chalet.repository';

export interface ChaletResponse {
  id: string;
  number: number;
  name: string;
  status: string;
  owner: { id: string; name: string } | null;
  members: Array<{ id: string; name: string }>;
}

/**
 * `status` vem calculado das reservas (ver `domain/chalet-occupancy.ts`), por
 * isso é parâmetro e não sai do registro do chalé.
 */
export const toChaletResponse = (
  chalet: ChaletWithOwner,
  status: ChaletStatus,
): ChaletResponse => ({
  id: chalet.id,
  number: chalet.number,
  name: chalet.name,
  status,
  owner: chalet.owner ? { id: chalet.owner.id, name: chalet.owner.name } : null,
  members:
    chalet.members?.map((m) => ({ id: m.user.id, name: m.user.name })) ?? [],
});
