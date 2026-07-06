import { ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { MongodbService } from '../database/mongodb/mongodb.service';
import { UserDocument } from '../database/mongodb/schemas/user.schema';
import { AuthenticatedUser } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';

const KEY_PREFIX_LENGTH = 12;

@Injectable()
export class AuthService {
  constructor(private readonly db: MongodbService) {}

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  async register(dto: RegisterDto) {
    const existing = await this.db.users.findOne({ email: dto.email });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const user = await this.db.users.create({
      email: dto.email,
      name: dto.name,
    });

    const rawKey = `tts_live_${randomBytes(32).toString('base64url')}`;
    const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH);

    await this.db.apiKeys.create({
      userId: user._id,
      keyPrefix,
      keyHash: this.hashKey(rawKey),
    });

    return { apiKey: rawKey, keyPrefix };
  }

  async validateKey(rawKey: string): Promise<AuthenticatedUser | null> {
    const keyHash = this.hashKey(rawKey);
    const apiKey = await this.db.apiKeys
      .findOne({ keyHash, revokedAt: null })
      .populate<{ userId: UserDocument }>('userId');

    if (!apiKey || !apiKey.userId) {
      return null;
    }

    void this.db.apiKeys
      .updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() })
      .exec();

    const user = apiKey.userId;
    return {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      keyPrefix: apiKey.keyPrefix,
      createdAt: user.get('createdAt') as Date,
    };
  }
}
