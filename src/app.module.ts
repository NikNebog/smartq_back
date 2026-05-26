import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [PrismaModule, AuthModule, TicketsModule, QueueModule],
})
export class AppModule {}