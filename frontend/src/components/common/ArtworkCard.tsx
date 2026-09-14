import LazyLoad from 'react-lazyload';
import { Link } from 'react-router-dom';

import type { Artist, Artwork } from '../../types';
import { formatArtworkSize } from '../../utils/formatArtworkSize';
import { StatusBadge } from './StatusBadge';

export function ArtworkCard({ artwork, artist, compact = false }: { artwork: Artwork; artist?: Artist; compact?: boolean }) {
  return (
    <Link to={`/artwork/${artwork.id}`} className="group block">
      <article className="overflow-hidden bg-rice transition duration-300 hover:-translate-y-1">
        <LazyLoad height={compact ? 180 : 280} offset={120} once>
          <img className={`w-full object-cover ${compact ? 'h-44' : 'h-72'}`} src={artwork.imageUrls[0]} alt={artwork.title} />
        </LazyLoad>
        <div className="border-x border-b border-ink/15 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl text-ink group-hover:text-clay">{artwork.title}</h3>
              <p className="mt-1 text-sm text-ink/60">{artist?.artistName ?? 'Unknown'} · {artwork.year}</p>
            </div>
            <StatusBadge status={artwork.status} />
          </div>
          <p className="mt-3 line-clamp-2 text-sm text-ink/70">{artwork.description}</p>
          <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-wide text-ink/55">
            <span>{formatArtworkSize(artwork.size)}</span>
            <span>{artwork.likes} likes</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
