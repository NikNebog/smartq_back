import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { TicketStatus } from '@prisma/client';

@UseGuards(JwtGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post()
  create(@Body() body: { serviceTypeId: number; priority?: number }) {
    return this.ticketsService.create(body.serviceTypeId, body.priority);
  }

  @Post(':id/arrive')
  arrive(@Param('id') id: string) {
    return this.ticketsService.arriveTicket(+id);
  }

  @Post(':id/no-show')
  noShow(@Param('id') id: string) {
    return this.ticketsService.noShowTicket(+id);
  }

  @Get()
  findAll(@Query('status') status?: TicketStatus) {
    return this.ticketsService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(+id);
  }

  @Post(':id/call')
  call(@Param('id') id: string) {
    return this.ticketsService.callTicket(+id);
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.ticketsService.startService(+id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.ticketsService.completeTicket(+id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.ticketsService.cancelTicket(+id);
  }

  @Post(':id/redirect')
  redirect(@Param('id') id: string, @Body() body: { newRoomId: number }) {
    return this.ticketsService.redirectTicket(+id, body.newRoomId);
  }
}