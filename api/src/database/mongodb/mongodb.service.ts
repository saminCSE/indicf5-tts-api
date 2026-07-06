import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiKey } from './schemas/api-key.schema';
import { Job } from './schemas/job.schema';
import { User } from './schemas/user.schema';

@Injectable()
export class MongodbService {
  constructor(
    @InjectModel(User.name) public readonly users: Model<User>,
    @InjectModel(ApiKey.name) public readonly apiKeys: Model<ApiKey>,
    @InjectModel(Job.name) public readonly jobs: Model<Job>,
  ) {}
}
