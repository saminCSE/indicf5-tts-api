import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ApiKey {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  keyPrefix!: string;

  @Prop({ required: true, unique: true })
  keyHash!: string;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}

export type ApiKeyDocument = HydratedDocument<ApiKey>;
export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
