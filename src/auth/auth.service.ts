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
    // Проверяем что email не занят
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email уже используется');

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаём пользователя с привязкой к кабинету
    const user = await this.prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        role,
        roomId: roomId ? roomId : null, // Привязываем кабинет, если он передан
      },
    });

    // Возвращаем токен
    return this.signToken(user.id, user.email, user.role);
  }

  // Вход
  async login(email: string, password: string) {
    // Ищем пользователя
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Неверный email или пароль');

    // Проверяем пароль
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Неверный email или пароль');

    // Возвращаем токен
    return this.signToken(user.id, user.email, user.role);
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

  // Обновление пользователя (Новый метод)
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