import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongodbService } from './mongodb.service';
import { ApiKey, ApiKeySchema } from './schemas/api-key.schema';
import { Job, JobSchema } from './schemas/job.schema';
import { User, UserSchema } from './schemas/user.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: Job.name, schema: JobSchema },
    ]),
  ],
  providers: [MongodbService],
  exports: [MongodbService],
})
export class MongodbModule {}
