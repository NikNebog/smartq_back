import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: { name: string; serviceTypeIds: number[]; isActive: boolean }) {
    return this.roomsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.roomsService.update(Number(id), body);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.roomsService.deactivate(Number(id));
  }

  @Get(':id/queue')
  getQueue(@Param('id') id: string) {
    return this.roomsService.getQueue(Number(id));
  }
}