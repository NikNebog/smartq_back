import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomsModule } from './rooms/rooms.module';
import { ServiceTypesModule } from './service-types/service-types.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [RoomsModule, ServiceTypesModule, AnalyticsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}