import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true })
  actorId!: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  path!: string;

  @Prop({ required: true })
  method!: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
