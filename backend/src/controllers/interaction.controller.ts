import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { InteractionService } from '../services/interaction.service';
import { ok } from '../utils/response';

@Controller('api/interactions')
export class InteractionController {
  constructor(private readonly interactionService: InteractionService) {}

  @Get()
  async list(@Query() query: { targetType?: string; targetId?: string }) {
    return this.interactionService.list(query);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return ok(await this.interactionService.create(body));
  }
}
