import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { RoomsService } from './rooms.service';

// Маппинг из значений БД в то, что ждёт фронт
const placeTypeToFrontend: Record<string, string> = {
  CABINET: 'cabinet',
  WINDOW: 'window',
  TABLE: 'desk', // Фикс от Claude: фронт ждет именно "desk", а не "table"
};

function normalizeRoomResponse(room: any) {
  if (!room) return room;
  return {
    ...room,
    // Фронт читает workStartTime / workEndTime (без "ing")
    workStartTime: room.workingStartTime ?? null,
    workEndTime: room.workingEndTime ?? null,
    // Нормализуем placeType под ожидания фронта
    placeType: placeTypeToFrontend[room.placeType] ?? 'cabinet',
    // Нормализуем вложенные serviceTypes
    serviceTypes: room.serviceTypes?.map((st: any) => ({
      ...st,
      ...st.serviceType,
      id: st.serviceType?.id ?? st.serviceTypeId,
      name: st.serviceType?.name,
    })),
  };
}

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll() {
    const rooms = await this.roomsService.findAll();
    return rooms.map(normalizeRoomResponse);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const room = await this.roomsService.findOne(Number(id));
    return normalizeRoomResponse(room);
  }

  @Post()
  async create(@Body() body: any) {
    const name =
      body.name?.trim() ||
      body.title?.trim() ||
      body.roomName?.trim() ||
      null;

    const room = await this.roomsService.create({
      name,
      serviceTypeIds: body.serviceTypeIds || body.services || [],
      isActive: body.isActive ?? body.active ?? true,
      placeType: body.placeType,
      workingStartTime: body.workingStartTime ?? body.workStartTime,
      workingEndTime: body.workingEndTime ?? body.workEndTime,
    });

    return normalizeRoomResponse(room);
  }

  @Patch(':id') // Кавычка зафиксирована!
  async update(@Param('id') id: string, @Body() body: any) {
    const room = await this.roomsService.update(Number(id), body);
    return normalizeRoomResponse(room);
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
