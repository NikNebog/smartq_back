import { Controller, Post, Body, Get, UseGuards, Request, Patch, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: {
    name: string;
    email: string;
    password: string;
    role: any;
    roomId?: number;
  }) {
    return this.authService.register(
      body.name,
      body.email,
      body.password,
      body.role,
      body.roomId ? Number(body.roomId) : undefined
    );
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(@Request() req) {
    return this.authService.getMe(req.user.id);
  }

  @Get('users')
  findAll() {
    return this.authService.findAllUsers();
  }

  @Patch('users/:id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; email?: string; role?: any; roomId?: number }
  ) {
    return this.authService.updateUser(Number(id), body);
  }
}