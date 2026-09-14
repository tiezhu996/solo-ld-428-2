import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { ArtistService } from '../services/artist.service';
import { ok } from '../utils/response';

@Controller('api/artists')
export class ArtistController {
  constructor(private readonly artistService: ArtistService) {}

  @Get()
  async list() {
    return this.artistService.list();
  }

  @Get(':id')
  async find(@Param('id') id: string) {
    return ok(await this.artistService.find(id));
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return ok(await this.artistService.create(body));
  }
}
