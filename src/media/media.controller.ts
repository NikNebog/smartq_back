import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';

@Controller('media')
export class MediaController {
  constructor(private prisma: PrismaService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
      fileFilter: (_req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|mp4|webm|mov/;
        const ext = allowed.test(extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext || mime) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Недопустимый тип файла'), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const isVideo = /mp4|webm|mov/.test(extname(file.originalname).toLowerCase());
    const url = `/uploads/${file.filename}`;

    const media = await this.prisma.mediaFile.create({
      data: {
        type: isVideo ? 'video' : 'image',
        filename: file.filename,
        url,
      },
    });

    return media;
  }

  @Get()
  findAll() {
    return this.prisma.mediaFile.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('latest')
  async getLatest() {
    const [video, image] = await Promise.all([
      this.prisma.mediaFile.findFirst({
        where: { type: 'video' },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaFile.findFirst({
        where: { type: 'image' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { video, image };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const media = await this.prisma.mediaFile.findUnique({
      where: { id: Number(id) },
    });

    if (!media) {
      throw new BadRequestException('Файл не найден');
    }

    // Удаляем с диска
    const filepath = join(process.cwd(), 'uploads', media.filename);
    if (existsSync(filepath)) {
      unlinkSync(filepath);
    }

    return this.prisma.mediaFile.delete({ where: { id: Number(id) } });
  }
}