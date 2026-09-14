import { create } from 'zustand';

import { fetchArtworks } from '../api/artwork';
import type { Artwork } from '../types/artwork';

interface ArtworkState {
  artworks: Artwork[];
  loading: boolean;
  loadArtworks: () => Promise<void>;
  updateArtworkMetrics: (id: string, patch: Partial<Pick<Artwork, 'likes' | 'bookmarks' | 'views'>>) => void;
}

export const useArtworkStore = create<ArtworkState>((set) => ({
  artworks: [],
  loading: false,
  loadArtworks: async () => {
    set({ loading: true });
    const artworks = await fetchArtworks();
    set({ artworks, loading: false });
  },
  updateArtworkMetrics: (id, patch) =>
    set((state) => ({
      artworks: state.artworks.map((artwork) => (artwork.id === id ? { ...artwork, ...patch } : artwork)),
    })),
}));
