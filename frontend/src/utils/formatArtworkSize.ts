import type { Artwork } from '../types/artwork';

export function formatArtworkSize(size: Artwork['size']) {
  const parts = [size.length, size.width, size.height].filter((value): value is number => typeof value === 'number');
  return `${parts.join(' x ')} cm`;
}
