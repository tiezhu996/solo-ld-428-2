import { Bookmark, Heart, Share2 } from 'lucide-react';

import { useInteraction } from '../../hooks/useInteraction';
import type { Artwork } from '../../types/artwork';

export function InteractionBar({ artwork }: { artwork: Artwork }) {
  const { liked, bookmarked, toggleLike, toggleBookmark } = useInteraction(artwork.id, artwork.likes, artwork.bookmarks);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={toggleLike} className={`inline-flex items-center gap-2 border px-4 py-2 text-sm ${liked ? 'border-clay bg-clay text-rice' : 'border-ink/20 text-ink hover:border-clay'}`}>
        <Heart size={17} /> {liked ? artwork.likes + 1 : artwork.likes}
      </button>
      <button onClick={toggleBookmark} className={`inline-flex items-center gap-2 border px-4 py-2 text-sm ${bookmarked ? 'border-lapis bg-lapis text-rice' : 'border-ink/20 text-ink hover:border-lapis'}`}>
        <Bookmark size={17} /> {bookmarked ? artwork.bookmarks + 1 : artwork.bookmarks}
      </button>
      <button className="inline-flex items-center gap-2 border border-ink/20 px-4 py-2 text-sm text-ink hover:border-moss">
        <Share2 size={17} /> Share
      </button>
    </div>
  );
}
