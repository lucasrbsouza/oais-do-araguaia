export interface StoredFile {
  path: string;
}

export abstract class FileStorage {
  abstract save(buffer: Buffer, originalName: string): Promise<StoredFile>;
  abstract resolve(path: string): string;
  abstract delete(path: string): Promise<void>;
}
