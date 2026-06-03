import { Controller, Get, Delete, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtGuard)
  @Get()
  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        createdAt: true,
      },
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; role?: any; roomId?: number }
  ) {
    return this.prisma.user.update({
      where: { id: +id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.roomId !== undefined ? { roomId: body.roomId ? +body.roomId : null } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        createdAt: true,
      },
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post(':id/assign-room')
  assignRoom(
    @Param('id') id: string,
    @Body() body: { roomId: number }
  ) {
    return this.prisma.user.update({
      where: { id: +id },
      data: { roomId: body.roomId ? +body.roomId : null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roomId: true,
        createdAt: true,
      },
    });
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.prisma.user.delete({
      where: { id: +id },
    });
  }
}