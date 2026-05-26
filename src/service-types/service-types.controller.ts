import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ServiceTypesService } from './service-types.service';

@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  @Get()
  findAll() {
    return this.serviceTypesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceTypesService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: { name: string; averageDurationMinutes: number; priorityWeight: number }) {
    return this.serviceTypesService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.serviceTypesService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceTypesService.remove(Number(id));
  }
}