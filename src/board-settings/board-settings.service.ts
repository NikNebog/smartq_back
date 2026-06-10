import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type BoardSettingsRecord = {
  settings: unknown;
};

const defaultBoardSettings = {
  boardType: 'general',
  profiles: [],
  recentCallsLimit: 10,
  roomBoardId: '',
  screens: [],
  showRecentCalls: true,
  showTime: true,
  template: 'classic',
  voiceEnabled: true,
};

@Injectable()
export class BoardSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    const rows = await this.prisma.$queryRaw<BoardSettingsRecord[]>`
      SELECT "settings" FROM "board_settings"
      WHERE "id" = 1
      LIMIT 1
    `;

    return rows[0]?.settings ?? defaultBoardSettings;
  }

  async saveSettings(settings: Record<string, unknown>) {
    const nextSettings = {
      ...defaultBoardSettings,
      ...settings,
      profiles: Array.isArray(settings.profiles) ? settings.profiles : [],
      screens: Array.isArray(settings.screens) ? settings.screens : [],
    };

    const rows = await this.prisma.$queryRaw<BoardSettingsRecord[]>`
      INSERT INTO "board_settings" ("id", "settings", "updatedAt")
      VALUES (1, ${JSON.stringify(nextSettings)}::jsonb, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "settings" = EXCLUDED."settings",
        "updatedAt" = NOW()
      RETURNING "settings"
    `;

    return rows[0]?.settings ?? nextSettings;
  }
}
