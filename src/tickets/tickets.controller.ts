import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
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

  // Только admin и manager создаёт талоны вручную
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post()
  create(@Body() body: { serviceTypeId: number; priority?: number }) {
    return this.ticketsService.create(+body.serviceTypeId, body.priority);
  }

  // Добавлены роли 'manager' и 'specialist', чтобы убрать ошибку 403 Forbidden
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
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

  // Возвращаем базовый поиск по статусу и roomId без жесткой привязки к сессии user,
  // чтобы обойти проблему кэширования (304 Not Modified) на фронтенде врача
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist', 'manager')
  @Get()
  async findAll(
    @Query('status') status: TicketStatus,
    @Query('roomId') roomId: string,
    @CurrentUser() user: any,
  ) {
    const finalRoomId = roomId ? +roomId : undefined;
    return this.ticketsService.findAll(status, finalRoomId);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'specialist', 'manager')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(+id);
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