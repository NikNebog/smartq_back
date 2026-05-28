import { Controller, Get, Post, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TicketStatus } from '@prisma/client';

@UseGuards(JwtGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  // Только admin создаёт талоны
  @Post()
  @Roles('admin')
  create(@Body() body: { serviceTypeId: number; priority?: number }) {
    return this.ticketsService.create(body.serviceTypeId, body.priority);
  }

  @Post(':id/arrive')
  @Roles('admin')
  arrive(@Param('id') id: string) {
    return this.ticketsService.arriveTicket(+id);
  }

  @Post(':id/no-show')
  @Roles('admin', 'specialist')
  noShow(@Param('id') id: string) {
    return this.ticketsService.noShowTicket(+id);
  }

  // admin видит все талоны, specialist только свои
  @Get()
  @Roles('admin', 'specialist', 'manager')
  async findAll(
    @Query('status') status: TicketStatus,
    @Query('roomId') roomId: string,
    @CurrentUser() user: any,
  ) {
    if (user.role === 'specialist' && !roomId) {
      throw new ForbiddenException('Specialist должен указать roomId');
    }
    return this.ticketsService.findAll(status, roomId ? +roomId : undefined);
  }

  @Get(':id')
  @Roles('admin', 'specialist', 'manager')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(+id);
  }

  // Вызвать пациента — только specialist и admin
  @Post(':id/call')
  @Roles('admin', 'specialist')
  call(@Param('id') id: string) {
    return this.ticketsService.callTicket(+id);
  }

  @Post(':id/start')
  @Roles('admin', 'specialist')
  start(@Param('id') id: string) {
    return this.ticketsService.startService(+id);
  }

  @Post(':id/complete')
  @Roles('admin', 'specialist')
  complete(@Param('id') id: string) {
    return this.ticketsService.completeTicket(+id);
  }

  @Post(':id/cancel')
  @Roles('admin')
  cancel(@Param('id') id: string) {
    return this.ticketsService.cancelTicket(+id);
  }

  // Перенаправить — только admin
  @Post(':id/redirect')
  @Roles('admin')
  redirect(@Param('id') id: string, @Body() body: { newRoomId: number }) {
    return this.ticketsService.redirectTicket(+id, body.newRoomId);
  }
}