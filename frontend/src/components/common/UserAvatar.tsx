import type { Artist } from '../../types/artist';

export function UserAvatar({ artist, size = 'md' }: { artist: Artist; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-24 w-24' : size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';
  return (
    <div className="flex items-center gap-3">
      <img className={`${sizeClass} rounded-full object-cover ring-2 ring-clay/40`} src={artist.avatarUrl} alt={artist.artistName} />
      <div>
        <p className="font-semibold text-ink">{artist.artistName}</p>
        <p className="text-sm text-ink/60">{artist.followerCount.toLocaleString()} followers</p>
      </div>
    </div>
  );
}
