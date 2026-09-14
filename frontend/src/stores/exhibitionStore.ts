import { create } from 'zustand';

import { fetchExhibitions } from '../api/exhibition';
import type { Exhibition } from '../types/exhibition';

interface ExhibitionState {
  exhibitions: Exhibition[];
  loadExhibitions: () => Promise<void>;
}

export const useExhibitionStore = create<ExhibitionState>((set) => ({
  exhibitions: [],
  loadExhibitions: async () => set({ exhibitions: await fetchExhibitions() }),
}));
