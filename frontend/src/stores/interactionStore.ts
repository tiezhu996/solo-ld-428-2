import { create } from 'zustand';

import { createInteraction, fetchInteractions } from '../api/interaction';
import type { Interaction, InteractionTarget } from '../types/interaction';
import { InteractionType } from '../types/enums';

interface InteractionState {
  interactions: Interaction[];
  loadInteractions: (targetType: InteractionTarget, targetId: string) => Promise<void>;
  addInteraction: (input: { targetType: InteractionTarget; targetId: string; type: InteractionType; comment?: string }) => Promise<void>;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  interactions: [],
  loadInteractions: async (targetType, targetId) => set({ interactions: await fetchInteractions(targetType, targetId) }),
  addInteraction: async (input) => {
    const saved = await createInteraction(input);
    set((state) => ({ interactions: [saved, ...state.interactions] }));
  },
}));
