import { apiPaths } from '../constants/apiPaths';
import { artworks } from '../utils/mockData';
import { request } from '../utils/request';
import type { Artwork } from '../types/artwork';

export async function fetchArtworks(): Promise<Artwork[]> {
  try {
    return await request<Artwork[]>(apiPaths.artworks);
  } catch {
    return artworks;
  }
}

export async function fetchArtwork(id: string): Promise<Artwork | undefined> {
  const list = await fetchArtworks();
  return list.find((artwork) => artwork.id === id);
}
