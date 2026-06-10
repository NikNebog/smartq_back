import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { AppSettingsService } from './app-settings.service';

@Controller('app-settings')
export class AppSettingsController {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  @Get()
  getSettings() {
    return this.appSettingsService.getSettings();
  }

  @Patch()
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.appSettingsService.updateSettings(body);
  }

  @Put()
  replaceSettings(@Body() body: Record<string, unknown>) {
    return this.appSettingsService.updateSettings(body);
  }
}
