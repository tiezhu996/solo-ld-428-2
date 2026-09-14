import { ArtistStatus, Medium } from './enums';

export interface Artist {
  id: string;
  userId: string;
  artistName: string;
  bio: string;
  avatarUrl: string;
  mediums: Medium[];
  featuredWorkUrls: string[];
  socialLinks: Record<string, string>;
  followingCount: number;
  followerCount: number;
  status: ArtistStatus;
}
