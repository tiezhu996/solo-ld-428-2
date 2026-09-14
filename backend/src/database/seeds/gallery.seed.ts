import { ArtworkStatus, ExhibitionStatus, Medium } from '../../types/enums';

export const seedArtists = [
  {
    userId: 'user-lin',
    artistName: '林知微',
    bio: '以东方纸本纹理和城市拆迁现场为线索。',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    mediums: [Medium.Ink, Medium.Mixed, Medium.Installation],
    featuredWorkUrls: [],
    socialLinks: { website: 'https://example.com/lin' },
    followingCount: 36,
    followerCount: 1280,
    status: 'Active',
  },
];

export const seedArtworks = [
  {
    title: '墙体记忆 No.7',
    description: '纸本、矿物颜料与拆除墙皮拓印组成的混合材料作品。',
    year: 2025,
    medium: Medium.Mixed,
    materials: '纸本、矿物颜料、石灰墙皮',
    size: { length: 120, width: 90, height: 4 },
    imageUrls: ['https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80'],
    tags: ['城市记忆', '混合材料'],
    artistId: 'artist-lin',
    exhibitionIds: ['exh-001'],
    status: ArtworkStatus.Published,
    views: 4820,
    likes: 318,
    bookmarks: 92,
  },
];

export const seedExhibitions = [
  {
    title: '材料仍在说话',
    description: '围绕城市更新、人工光和材料记忆展开的小型群展。',
    curatorId: 'artist-lin',
    startDate: '2026-05-01',
    endDate: '2026-08-15',
    type: 'Group',
    coverUrl: 'https://images.unsplash.com/photo-1545987796-200677ee1011?auto=format&fit=crop&w=1400&q=80',
    artworkIds: ['art-001'],
    status: ExhibitionStatus.Active,
    visitors: 12840,
  },
];
