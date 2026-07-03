import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
