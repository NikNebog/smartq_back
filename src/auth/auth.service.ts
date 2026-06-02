import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // Регистрация
  async register(name: string, email: string, password: string, role: Role, roomId?: number) {
    // Проверяем что email не занят
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email уже используется');

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаём пользователя
    const user = await this.prisma.user.create({
      data: { name, email, password: hashedPassword, role, roomId },
      include: { room: true },
    });

    // Возвращаем токен
    return this.signToken(user);
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
    return this.signToken(user);
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { room: true },
    });

    if (!user) throw new NotFoundException('Пользователь не найден');

    return this.toPublicUser(user);
  }

  async findUsers(role?: Role) {
    const users = await this.prisma.user.findMany({
      where: role ? { role } : undefined,
      include: { room: true },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.toPublicUser(user));
  }

  async updateUser(
    id: number,
    data: {
      email?: string;
      name?: string;
      password?: string;
      role?: Role;
      roomId?: number | null;
      assignedRoomId?: number | null;
    },
  ) {
    const { password, assignedRoomId, roomId, ...rest } = data;
    const nextRoomId = roomId ?? assignedRoomId;
    const updateData: any = {
      ...rest,
      ...(nextRoomId !== undefined ? { roomId: nextRoomId } : {}),
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { room: true },
    });

    return this.toPublicUser(user);
  }

  async assignRoom(id: number, roomId: number) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { roomId },
      include: { room: true },
    });

    return this.toPublicUser(user);
  }

  async deleteUser(id: number) {
    await this.prisma.user.delete({ where: { id } });
  }

  // Генерация JWT токена
  private signToken(user: { id: number; email: string; role: Role; name: string; roomId?: number | null; room?: { id: number; name: string } | null }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: {
    email: string;
    id: number;
    name: string;
    role: Role;
    roomId?: number | null;
    room?: { id: number; name: string } | null;
  }) {
    return {
      assignedRoomId: user.roomId ?? null,
      email: user.email,
      id: user.id,
      name: user.name,
      role: user.role,
      room: user.room ?? null,
      roomId: user.roomId ?? null,
    };
  }
}
