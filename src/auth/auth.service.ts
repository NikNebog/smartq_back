import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // Регистрация
  async register(name: string, email: string, password: string, role: any, roomId?: number) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email уже используется');

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        roomId: roomId ? roomId : null,
      },
    });

    return this.signToken(user.id, user.email, user.role);
  }

  // Вход
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Неверный email или пароль');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Неверный email или пароль');

    return this.signToken(user.id, user.email, user.role);
  }

  // Текущий пользователь
  async getMe(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
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

  // Получение всех пользователей
  async findAllUsers() {
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

  // Обновление пользователя
  async updateUser(id: number, data: { name?: string; email?: string; role?: any; roomId?: number }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        role: data.role,
        roomId: data.roomId ? Number(data.roomId) : null,
      },
    });
  }

  // Генерация JWT токена
  private signToken(userId: number, email: string, role: any) {
    const payload = { sub: userId, email, role };
    return {
      access_token: this.jwt.sign(payload),
      role,
    };
  }
}