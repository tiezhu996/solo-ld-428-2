import { useState } from 'react';

import { useArtworkStore } from '../stores/artworkStore';
import { useInteractionStore } from '../stores/interactionStore';
import { InteractionType } from '../types/enums';

export function useInteraction(artworkId: string, initialLikes: number, initialBookmarks: number) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const updateArtworkMetrics = useArtworkStore((state) => state.updateArtworkMetrics);
  const addInteraction = useInteractionStore((state) => state.addInteraction);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    updateArtworkMetrics(artworkId, { likes: initialLikes + (next ? 1 : 0) });
    await addInteraction({ targetType: 'Artwork', targetId: artworkId, type: InteractionType.Like });
  };

  const toggleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    updateArtworkMetrics(artworkId, { bookmarks: initialBookmarks + (next ? 1 : 0) });
    await addInteraction({ targetType: 'Artwork', targetId: artworkId, type: InteractionType.Bookmark });
  };

  return { liked, bookmarked, toggleLike, toggleBookmark };
}
