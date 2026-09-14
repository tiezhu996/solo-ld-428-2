import { FormEvent, useEffect, useState } from 'react';

import { useInteractionStore } from '../../stores/interactionStore';
import { InteractionType } from '../../types/enums';

export function CommentSection({ artworkId }: { artworkId: string }) {
  const [comment, setComment] = useState('');
  const { interactions, loadInteractions, addInteraction } = useInteractionStore();
  const comments = interactions.filter((item) => item.type === InteractionType.Comment);

  useEffect(() => {
    void loadInteractions('Artwork', artworkId);
  }, [artworkId, loadInteractions]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    await addInteraction({ targetType: 'Artwork', targetId: artworkId, type: InteractionType.Comment, comment });
    setComment('');
  };

  return (
    <section className="border-t border-ink/15 pt-6">
      <h2 className="font-display text-2xl text-ink">评论</h2>
      <form onSubmit={submit} className="mt-4 flex gap-3">
        <input value={comment} onChange={(event) => setComment(event.target.value)} className="min-w-0 flex-1 border border-ink/20 bg-rice px-4 py-3 outline-none focus:border-clay" placeholder="写下你的观看感受" />
        <button className="bg-ink px-5 py-3 text-sm font-semibold text-rice hover:bg-clay">发布</button>
      </form>
      <div className="mt-5 space-y-3">
        {comments.map((item) => (
          <div key={item.id} className="border border-ink/10 bg-rice p-4">
            <p className="text-sm text-ink/75">{item.comment}</p>
            <p className="mt-2 text-xs text-ink/45">{new Date(item.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
