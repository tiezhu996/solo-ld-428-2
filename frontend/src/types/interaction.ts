import { InteractionType } from './enums';

export type InteractionTarget = 'Artwork' | 'Exhibition';

export interface Interaction {
  id: string;
  userId: string;
  targetType: InteractionTarget;
  targetId: string;
  type: InteractionType;
  comment?: string;
  createdAt: string;
}
