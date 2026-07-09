import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { ValidationError } from '../../../shared/domain/domain-error';
import { FileStorage, StoredFile } from '../domain/file-storage';

@Injectable()
export class LocalFileStorage implements FileStorage {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    this.baseDir = config.getOrThrow<string>('UPLOAD_DIR');
  }

  async save(buffer: Buffer, originalName: string): Promise<StoredFile> {
    await mkdir(this.baseDir, { recursive: true });
    const fileName = `${randomUUID()}${extname(originalName).toLowerCase()}`;
    await writeFile(join(this.baseDir, fileName), buffer);
    return { path: fileName };
  }

  resolve(path: string): string {
    const resolved = normalize(join(this.baseDir, path));
    if (!resolved.startsWith(normalize(this.baseDir))) {
      throw new ValidationError('Caminho de arquivo inválido.');
    }
    return resolved;
  }

  async delete(path: string): Promise<void> {
    try {
      await unlink(this.resolve(path));
    } catch {
      // arquivo já removido — ignorar
    }
  }
}
