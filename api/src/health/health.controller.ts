import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  check() {
    const mongoConnected =
      this.connection.readyState === ConnectionStates.connected;
    return {
      status: mongoConnected ? 'ok' : 'degraded',
      mongo: mongoConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    };
  }
}
