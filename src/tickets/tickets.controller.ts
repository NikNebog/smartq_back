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

  @Get()
  findAll(@Query('status') status?: TicketStatus) {
    return this.ticketsService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(+id);
  }
}