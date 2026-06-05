import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('board-screens')
export class BoardScreensController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.boardScreen.findMany({ orderBy: { createdAt: 'asc' } });
  }

  @Post()
  create(@Body() body: { name: string; roomNames: string[] }) {
    return this.prisma.boardScreen.create({
      data: { name: body.name, roomNames: body.roomNames },
    });
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.prisma.boardScreen.delete({ where: { id: +id } });
  }
}
