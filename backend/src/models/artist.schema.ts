import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ArtistDocument = HydratedDocument<Artist>;

@Schema({ timestamps: true })
export class Artist {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  artistName!: string;

  @Prop({ required: true })
  bio!: string;

  @Prop({ required: true })
  avatarUrl!: string;

  @Prop({ type: [String], default: [] })
  mediums!: string[];

  @Prop({ type: [String], default: [] })
  featuredWorkUrls!: string[];

  @Prop({ type: Object, default: {} })
  socialLinks!: Record<string, string>;

  @Prop({ default: 0 })
  followingCount!: number;

  @Prop({ default: 0 })
  followerCount!: number;

  @Prop({ default: 'Active' })
  status!: string;
}

export const ArtistSchema = SchemaFactory.createForClass(Artist);
