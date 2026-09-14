import { Tab } from '@headlessui/react';
import { useEffect, useMemo, useState } from 'react';

import { ArtworkCard } from '../components/common/ArtworkCard';
import { EmptyState } from '../components/common/EmptyState';
import { StatCard } from '../components/common/StatCard';
import { TrendChart } from '../components/common/TrendChart';
import { useArtistStore } from '../stores/artistStore';
import { useArtworkStore } from '../stores/artworkStore';
import { ArtworkStatus } from '../types/enums';

const tabs = [ArtworkStatus.Draft, ArtworkStatus.Published, ArtworkStatus.Sold];

export function Studio() {
  const [draftTitle, setDraftTitle] = useState('');
  const { artworks, loadArtworks } = useArtworkStore();
  const { artists, loadArtists } = useArtistStore();

  useEffect(() => {
    void Promise.all([loadArtworks(), loadArtists()]);
  }, [loadArtworks, loadArtists]);

  const totals = useMemo(() => ({
    views: artworks.reduce((sum, item) => sum + item.views, 0),
    likes: artworks.reduce((sum, item) => sum + item.likes, 0),
    bookmarks: artworks.reduce((sum, item) => sum + item.bookmarks, 0),
  }), [artworks]);

  const artist = artists[0];

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-clay">Artist studio</p>
            <h1 className="mt-2 font-display text-6xl">创作工作台</h1>
          </div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setDraftTitle(''); }}>
            <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="border border-ink/20 bg-rice px-4 py-3 outline-none focus:border-clay" placeholder="新作品标题" />
            <button className="bg-ink px-5 py-3 text-sm font-semibold text-rice hover:bg-clay">上传草稿</button>
          </form>
        </div>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard label="总浏览" value={totals.views.toLocaleString()} />
          <StatCard label="点赞" value={totals.likes.toLocaleString()} />
          <StatCard label="收藏" value={totals.bookmarks.toLocaleString()} />
        </section>
        <section className="mt-6">
          <TrendChart likes={totals.likes} bookmarks={totals.bookmarks} views={totals.views} />
        </section>
        <Tab.Group>
          <Tab.List className="mt-10 flex gap-2 border-b border-ink/15">
            {tabs.map((tab) => (
              <Tab key={tab} className={({ selected }) => `px-5 py-3 text-sm outline-none ${selected ? 'bg-ink text-rice' : 'text-ink/65 hover:text-ink'}`}>{tab}</Tab>
            ))}
          </Tab.List>
          <Tab.Panels className="mt-6">
            {tabs.map((tab) => {
              const list = artworks.filter((artwork) => artwork.status === tab);
              return (
                <Tab.Panel key={tab}>
                  {list.length ? (
                    <div className="grid gap-5 md:grid-cols-3">
                      {list.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} artist={artist} compact />)}
                    </div>
                  ) : (
                    <EmptyState title={`${tab} 列表为空`} description="状态变化后作品会自动进入对应队列。" />
                  )}
                </Tab.Panel>
              );
            })}
          </Tab.Panels>
        </Tab.Group>
      </div>
    </main>
  );
}
