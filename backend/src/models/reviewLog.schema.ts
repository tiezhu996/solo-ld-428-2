import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { ReviewResult } from '../types/enums';

export type ReviewLogDocument = HydratedDocument<ReviewLog>;

@Schema({ timestamps: true })
export class ReviewLog {
  @Prop({ enum: ['Artwork', 'Exhibition'], required: true, index: true })
  targetType!: 'Artwork' | 'Exhibition';

  @Prop({ required: true, index: true })
  targetId!: string;

  @Prop({ required: true })
  reviewerId!: string;

  @Prop({ enum: ReviewResult, required: true })
  result!: ReviewResult;

  @Prop({ default: '' })
  comment!: string;
}

export const ReviewLogSchema = SchemaFactory.createForClass(ReviewLog);
