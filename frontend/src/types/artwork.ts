import { ArtworkStatus, Medium } from './enums';

export interface Artwork {
  id: string;
  title: string;
  description: string;
  year: number;
  medium: Medium;
  materials: string;
  size: { length: number; width: number; height?: number };
  imageUrls: string[];
  videoUrl?: string;
  tags: string[];
  artistId: string;
  exhibitionIds: string[];
  status: ArtworkStatus;
  price?: number;
  views: number;
  likes: number;
  bookmarks: number;
}
