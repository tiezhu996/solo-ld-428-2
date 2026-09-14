import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Artwork, ArtworkDocument } from '../models/artwork.schema';
import { ArtworkStatus } from '../types/enums';

@Injectable()
export class ArtworkService {
  constructor(@InjectModel(Artwork.name) private readonly artworkModel: Model<ArtworkDocument>) {}

  async list() {
    return this.artworkModel.find().sort({ updatedAt: -1 }).lean();
  }

  async find(id: string) {
    return this.artworkModel.findById(id).lean();
  }

  async create(input: Partial<Artwork>) {
    return this.artworkModel.create(input);
  }

  async publish(id: string) {
    return this.artworkModel.findByIdAndUpdate(id, { status: ArtworkStatus.Published }, { new: true });
  }

  async incrementMetric(id: string, field: 'likes' | 'bookmarks' | 'views', amount = 1) {
    return this.artworkModel.findByIdAndUpdate(id, { $inc: { [field]: amount } }, { new: true });
  }
}
