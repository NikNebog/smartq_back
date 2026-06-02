import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtGuard } from './guards/jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: { 
    name: string; 
    email: string; 
    password: string; 
    role: Role;
    roomId?: number;
    assignedRoomId?: number;
  }) {
    return this.authService.register(
      body.name, 
      body.email, 
      body.password, 
      body.role,
      body.roomId ?? body.assignedRoomId,
    );
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager', 'specialist')
  @Get('me')
  me(@CurrentUser() user: { id: number }) {
    return this.authService.me(user.id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('users')
  users(@Query('role') role?: Role) {
    return this.authService.findUsers(role);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.authService.updateUser(Number(id), body);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Patch('users/:id/assign-room')
  assignRoomPatch(@Param('id') id: string, @Body() body: { roomId: number }) {
    return this.authService.assignRoom(Number(id), Number(body.roomId));
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Post('users/:id/assign-room')
  assignRoom(@Param('id') id: string, @Body() body: { roomId: number }) {
    return this.authService.assignRoom(Number(id), Number(body.roomId));
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles('admin')
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(Number(id));
  }
}
