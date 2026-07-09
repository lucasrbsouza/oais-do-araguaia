import { ChaletWithOwner } from '../domain/chalet.repository';

export interface ChaletResponse {
  id: string;
  number: number;
  name: string;
  status: string;
  owner: { id: string; name: string } | null;
}

export const toChaletResponse = (chalet: ChaletWithOwner): ChaletResponse => ({
  id: chalet.id,
  number: chalet.number,
  name: chalet.name,
  status: chalet.status,
  owner: chalet.owner ? { id: chalet.owner.id, name: chalet.owner.name } : null,
});
