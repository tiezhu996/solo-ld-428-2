import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Artist, ArtistDocument } from '../models/artist.schema';

@Injectable()
export class ArtistService {
  constructor(@InjectModel(Artist.name) private readonly artistModel: Model<ArtistDocument>) {}

  async list() {
    return this.artistModel.find().sort({ followerCount: -1 }).lean();
  }

  async find(id: string) {
    return this.artistModel.findById(id).lean();
  }

  async create(input: Partial<Artist>) {
    return this.artistModel.create(input);
  }
}
