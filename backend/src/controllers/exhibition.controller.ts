import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { ExhibitionService } from '../services/exhibition.service';
import { ok } from '../utils/response';

@Controller('api/exhibitions')
export class ExhibitionController {
  constructor(private readonly exhibitionService: ExhibitionService) {}

  @Get()
  async list() {
    return this.exhibitionService.list();
  }

  @Get(':id')
  async find(@Param('id') id: string) {
    return ok(await this.exhibitionService.find(id));
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return ok(await this.exhibitionService.create(body));
  }

  @Patch(':id/artworks')
  async addArtwork(@Param('id') id: string, @Body('artworkId') artworkId: string) {
    return ok(await this.exhibitionService.addArtwork(id, artworkId));
  }

  @Patch(':id/publish')
  async publish(@Param('id') id: string) {
    return ok(await this.exhibitionService.publish(id));
  }
}
