import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TicketStatus } from '@prisma/client';

@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  // Для автомата — без авторизации
  @Post('kiosk')
  createFromKiosk(@Body() body: { serviceTypeId: number; priority?: number }) {
    return this.ticketsService.create(body.serviceTypeId, body.priority);
  }

  // Только admin создаёт талоны вручную
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post()
  create(@Body() body: { doctorId?: number; etaMinutes?: number; roomId?: number; serviceTypeId: number; priority?: number; status?: TicketStatus }) {
    return this.ticketsService.create(body.serviceTypeId, body.priority, {
      doctorId: body.doctorId,
      etaMinutes: body.etaMinutes,
      roomId: body.roomId,
      status: body.status,
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/arrive')
  arrive(@Param('id') id: string) {
    return this.ticketsService.arriveTicket(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/no-show')
  noShow(@Param('id') id: string) {
    return this.ticketsService.noShowTicket(+id);
  }

  // admin и manager видят все талоны, specialist только свой кабинет
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist', 'manager')
  @Get()
  async findAll(
    @Query('status') status: TicketStatus,
    @Query('roomId') roomId: string,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.findAll(status, roomId ? +roomId : undefined);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist', 'manager')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.ticketsService.updateTicket(+id, {
      doctorId: body.doctorId == null ? undefined : Number(body.doctorId),
      etaMinutes: body.etaMinutes == null ? undefined : Number(body.etaMinutes),
      priority: body.priority == null ? undefined : Number(body.priority),
      roomId: body.roomId === undefined ? undefined : body.roomId === null ? null : Number(body.roomId),
      serviceTypeId: body.serviceTypeId == null ? undefined : Number(body.serviceTypeId),
      status: body.status,
    });
  }

  // Вызвать — specialist и admin
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/call')
  call(@Param('id') id: string) {
    return this.ticketsService.callTicket(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.ticketsService.startService(+id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist')
  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.ticketsService.completeTicket(+id);
  }

  // Отменить — только admin
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.ticketsService.cancelTicket(+id);
  }

  // Перенаправить — только admin
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/redirect')
  redirect(@Param('id') id: string, @Body() body: { newRoomId: number }) {
    return this.ticketsService.redirectTicket(+id, body.newRoomId);
  }
}
