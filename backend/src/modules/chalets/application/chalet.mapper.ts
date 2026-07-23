import { ChaletWithOwner } from '../domain/chalet.repository';

export interface ChaletResponse {
  id: string;
  number: number;
  name: string;
  status: string;
  owner: { id: string; name: string } | null;
  members: Array<{ id: string; name: string }>;
}

export const toChaletResponse = (chalet: ChaletWithOwner): ChaletResponse => ({
  id: chalet.id,
  number: chalet.number,
  name: chalet.name,
  status: chalet.status,
  owner: chalet.owner ? { id: chalet.owner.id, name: chalet.owner.name } : null,
  members:
    chalet.members?.map((m) => ({ id: m.user.id, name: m.user.name })) ?? [],
});
