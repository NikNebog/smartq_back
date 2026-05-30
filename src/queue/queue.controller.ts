import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('queue')
export class QueueController {
  constructor(private queueService: QueueService) {}

  // Для телевизора — без авторизации
  @Get('board')
  getBoardData() {
    return this.queueService.getBoardData();
  }

  // Аналитика — среднее время по услугам
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('analytics/service-time')
  getAvgTimeByServiceType() {
    return this.queueService.getAvgTimeByServiceType();
  }

  // Аналитика — за период
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('analytics/period')
  getAnalyticsByPeriod(@Query('period') period: string) {
    return this.queueService.getAnalyticsByPeriod(period);
  }

  // Для всех авторизованных
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Get('stats')
  getStats() {
    return this.queueService.getQueueStats();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Get('room/:roomId')
  getQueueByRoom(@Param('roomId') roomId: string) {
    return this.queueService.getQueueByRoom(+roomId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Get('room/:roomId/next')
  getNextTicket(@Param('roomId') roomId: string) {
    return this.queueService.getNextTicket(+roomId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post('room/:roomId/recalculate')
  recalculateETA(@Param('roomId') roomId: string) {
    return this.queueService.recalculateETA(+roomId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('overload')
  checkOverload() {
    return this.queueService.checkOverload();
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('high-priority')
  getHighPriority() {
    return this.queueService.getHighPriorityWaiting();
  }
}