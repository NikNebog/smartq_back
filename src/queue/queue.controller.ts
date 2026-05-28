import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JwtGuard } from '../auth/guards/jwt.guard';

@UseGuards(JwtGuard)
@Controller('queue')
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Get('stats')
  getStats() {
    return this.queueService.getQueueStats();
  }

  @Get('room/:roomId')
  getQueueByRoom(@Param('roomId') roomId: string) {
    return this.queueService.getQueueByRoom(+roomId);
  }

  @Get('room/:roomId/next')
  getNextTicket(@Param('roomId') roomId: string) {
    return this.queueService.getNextTicket(+roomId);
  }

  @Post('room/:roomId/recalculate')
  recalculateETA(@Param('roomId') roomId: string) {
    return this.queueService.recalculateETA(+roomId);
  }

  @Get('overload')
  checkOverload() {
    return this.queueService.checkOverload();
  }

  @Get('high-priority')
  getHighPriority() {
    return this.queueService.getHighPriorityWaiting();
  }
}