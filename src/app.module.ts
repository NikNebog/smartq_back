import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomsModule } from './rooms/rooms.module';
import { ServiceTypesModule } from './service-types/service-types.module';

@Module({
  imports: [RoomsModule, ServiceTypesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}