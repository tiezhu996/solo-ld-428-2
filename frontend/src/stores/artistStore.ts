import { create } from 'zustand';

import { fetchArtists } from '../api/artist';
import type { Artist } from '../types/artist';

interface ArtistState {
  artists: Artist[];
  loadArtists: () => Promise<void>;
}

export const useArtistStore = create<ArtistState>((set) => ({
  artists: [],
  loadArtists: async () => set({ artists: await fetchArtists() }),
}));
