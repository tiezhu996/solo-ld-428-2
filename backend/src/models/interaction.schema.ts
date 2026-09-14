import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { InteractionType } from '../types/enums';

export type InteractionDocument = HydratedDocument<Interaction>;

@Schema({ timestamps: true })
export class Interaction {
  @Prop({ required: true })
  userId!: string;

  @Prop({ enum: ['Artwork', 'Exhibition'], required: true, index: true })
  targetType!: 'Artwork' | 'Exhibition';

  @Prop({ required: true, index: true })
  targetId!: string;

  @Prop({ enum: InteractionType, required: true })
  type!: InteractionType;

  @Prop()
  comment?: string;
}

export const InteractionSchema = SchemaFactory.createForClass(Interaction);
