import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Exhibition, ExhibitionDocument } from '../models/exhibition.schema';
import { ExhibitionStatus } from '../types/enums';

@Injectable()
export class ExhibitionService {
  constructor(@InjectModel(Exhibition.name) private readonly exhibitionModel: Model<ExhibitionDocument>) {}

  async list() {
    return this.exhibitionModel.find().sort({ startDate: -1 }).lean();
  }

  async find(id: string) {
    return this.exhibitionModel.findById(id).lean();
  }

  async create(input: Partial<Exhibition>) {
    return this.exhibitionModel.create(input);
  }

  async addArtwork(id: string, artworkId: string) {
    return this.exhibitionModel.findByIdAndUpdate(id, { $addToSet: { artworkIds: artworkId } }, { new: true });
  }

  async publish(id: string) {
    return this.exhibitionModel.findByIdAndUpdate(id, { status: ExhibitionStatus.Active }, { new: true });
  }
}
