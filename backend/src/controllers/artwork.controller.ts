import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { ArtworkService } from '../services/artwork.service';
import { ok } from '../utils/response';

@Controller('api/artworks')
export class ArtworkController {
  constructor(private readonly artworkService: ArtworkService) {}

  @Get()
  async list() {
    return this.artworkService.list();
  }

  @Get(':id')
  async find(@Param('id') id: string) {
    return ok(await this.artworkService.find(id));
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return ok(await this.artworkService.create(body));
  }

  @Patch(':id/publish')
  async publish(@Param('id') id: string) {
    return ok(await this.artworkService.publish(id));
  }
}
