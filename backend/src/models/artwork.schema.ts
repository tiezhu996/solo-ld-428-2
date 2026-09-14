import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { ArtworkStatus, Medium } from '../types/enums';

export type ArtworkDocument = HydratedDocument<Artwork>;

@Schema({ timestamps: true })
export class Artwork {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  year!: number;

  @Prop({ enum: Medium, required: true })
  medium!: Medium;

  @Prop({ required: true })
  materials!: string;

  @Prop({ type: Object, required: true })
  size!: { length: number; width: number; height?: number };

  @Prop({ type: [String], default: [] })
  imageUrls!: string[];

  @Prop()
  videoUrl?: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ required: true, index: true })
  artistId!: string;

  @Prop({ type: [String], default: [] })
  exhibitionIds!: string[];

  @Prop({ enum: ArtworkStatus, default: ArtworkStatus.Draft, index: true })
  status!: ArtworkStatus;

  @Prop()
  price?: number;

  @Prop({ default: 0 })
  views!: number;

  @Prop({ default: 0 })
  likes!: number;

  @Prop({ default: 0 })
  bookmarks!: number;
}

export const ArtworkSchema = SchemaFactory.createForClass(Artwork);
