import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { GridFSBucket } from 'mongodb';
import { Connection, Types } from 'mongoose';
import { Readable } from 'stream';
import { AudioStorage } from './audio-storage.interface';

@Injectable()
export class GridFsAudioStorage implements AudioStorage, OnModuleInit {
  private bucket!: GridFSBucket;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    this.bucket = new GridFSBucket(this.connection.db!, {
      bucketName: 'audio',
    });
  }

  save(buffer: Buffer, filename: string): Promise<Types.ObjectId> {
    return new Promise((resolve, reject) => {
      const upload = this.bucket.openUploadStream(filename, {
        contentType: 'audio/wav',
      });
      upload.once('error', reject);
      upload.once('finish', () =>
        resolve(new Types.ObjectId(upload.id.toString())),
      );
      upload.end(buffer);
    });
  }

  stream(fileId: Types.ObjectId): Readable {
    return this.bucket.openDownloadStream(fileId);
  }

  async delete(fileId: Types.ObjectId): Promise<void> {
    await this.bucket.delete(fileId);
  }
}
