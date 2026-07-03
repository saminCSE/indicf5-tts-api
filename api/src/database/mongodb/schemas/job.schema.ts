import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum JobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Job {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: JobStatus, default: JobStatus.QUEUED })
  status!: JobStatus;

  @Prop({ required: true })
  inputText!: string;

  @Prop({ required: true })
  charCount!: number;

  @Prop({ type: String, default: null })
  audioPath!: string | null;

  @Prop({ type: String, default: null })
  error!: string | null;
}

export type JobDocument = HydratedDocument<Job>;
export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.index({ userId: 1, createdAt: -1 });
