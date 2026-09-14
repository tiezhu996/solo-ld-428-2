import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { ExhibitionStatus } from '../types/enums';

export type ExhibitionDocument = HydratedDocument<Exhibition>;

@Schema({ timestamps: true })
export class Exhibition {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, index: true })
  curatorId!: string;

  @Prop({ required: true })
  startDate!: string;

  @Prop({ required: true })
  endDate!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  coverUrl!: string;

  @Prop({ type: [String], default: [] })
  artworkIds!: string[];

  @Prop({ enum: ExhibitionStatus, default: ExhibitionStatus.Planning, index: true })
  status!: ExhibitionStatus;

  @Prop({ default: 0 })
  visitors!: number;
}

export const ExhibitionSchema = SchemaFactory.createForClass(Exhibition);
