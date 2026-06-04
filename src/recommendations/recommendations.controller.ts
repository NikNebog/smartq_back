import { Controller, Get, Patch, Post, Param } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get()
  findAll() {
    return this.recommendationsService.findAll();
  }

  @Patch(':id/resolve')
  resolve(@Param('id') id: string) {
    return this.recommendationsService.resolve(Number(id));
  }

  @Post('reset-tickets')
  resetTickets() {
    return this.recommendationsService.resetDailyTickets();
  }
}