import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { QueueModule } from './queue/queue.module';
import { RoomsModule } from './rooms/rooms.module';
import { ServiceTypesModule } from './service-types/service-types.module';

@Module({
  imports: [PrismaModule, AuthModule, TicketsModule, QueueModule, RoomsModule, ServiceTypesModule],
})
export class AppModule {}