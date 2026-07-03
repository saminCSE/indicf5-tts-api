import { Types } from 'mongoose';
import { Readable } from 'stream';

export interface AudioStorage {
  save(buffer: Buffer, filename: string): Promise<Types.ObjectId>;
  stream(fileId: Types.ObjectId): Readable;
  delete(fileId: Types.ObjectId): Promise<void>;
}

export const AUDIO_STORAGE = Symbol('AUDIO_STORAGE');
