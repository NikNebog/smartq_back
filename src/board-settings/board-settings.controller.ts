import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { BoardSettingsService } from './board-settings.service';

@Controller('board-settings')
export class BoardSettingsController {
  constructor(private readonly boardSettingsService: BoardSettingsService) {}

  @Get()
  getSettings() {
    return this.boardSettingsService.getSettings();
  }

  @Patch()
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.boardSettingsService.saveSettings(body);
  }

  @Put()
  replaceSettings(@Body() body: Record<string, unknown>) {
    return this.boardSettingsService.saveSettings(body);
  }
}
