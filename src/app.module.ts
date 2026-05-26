import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { RoomsModule } from './rooms/rooms.module';
import { ServiceTypesModule } from './service-types/service-types.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RoomsModule,
    ServiceTypesModule,
    AnalyticsModule,
    RecommendationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}