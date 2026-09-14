import { apiPaths } from '../constants/apiPaths';
import type { Interaction, InteractionTarget } from '../types/interaction';
import { InteractionType } from '../types/enums';
import { interactions } from '../utils/mockData';
import { request } from '../utils/request';

export async function fetchInteractions(targetType: InteractionTarget, targetId: string): Promise<Interaction[]> {
  try {
    return await request<Interaction[]>(`${apiPaths.interactions}?targetType=${targetType}&targetId=${targetId}`);
  } catch {
    return interactions.filter((item) => item.targetType === targetType && item.targetId === targetId);
  }
}

export async function createInteraction(input: {
  targetType: InteractionTarget;
  targetId: string;
  type: InteractionType;
  comment?: string;
}): Promise<Interaction> {
  try {
    return await request<Interaction>(apiPaths.interactions, { method: 'POST', body: JSON.stringify(input) });
  } catch {
    return {
      id: crypto.randomUUID(),
      userId: 'viewer-local',
      createdAt: new Date().toISOString(),
      ...input,
    };
  }
}
