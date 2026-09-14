import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ReviewLog, ReviewLogDocument } from '../models/reviewLog.schema';
import { ReviewResult } from '../types/enums';

@Injectable()
export class ReviewService {
  constructor(@InjectModel(ReviewLog.name) private readonly reviewModel: Model<ReviewLogDocument>) {}

  async review(input: { targetType: 'Artwork' | 'Exhibition'; targetId: string; reviewerId: string; result: ReviewResult; comment?: string }) {
    return this.reviewModel.create(input);
  }

  async hasApproval(targetType: 'Artwork' | 'Exhibition', targetId: string) {
    return Boolean(await this.reviewModel.exists({ targetType, targetId, result: ReviewResult.Approved }));
  }
}
