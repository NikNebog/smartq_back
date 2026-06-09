import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TerminalsService } from './terminals.service';

@Controller('terminals')
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Get()
  findAll() {
    return this.terminalsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.terminalsService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: any) {
    return this.terminalsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.terminalsService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.terminalsService.remove(Number(id));
  }
}
