import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { ArtworkCard } from '../components/common/ArtworkCard';
import { EmptyState } from '../components/common/EmptyState';
import { ExhibitionBanner } from '../components/common/ExhibitionBanner';
import { usePagination } from '../hooks/usePagination';
import { useArtistStore } from '../stores/artistStore';
import { useArtworkStore } from '../stores/artworkStore';
import { useExhibitionStore } from '../stores/exhibitionStore';

export function Gallery() {
  const { artworks, loadArtworks } = useArtworkStore();
  const { artists, loadArtists } = useArtistStore();
  const { exhibitions, loadExhibitions } = useExhibitionStore();
  const { visibleItems, hasMore, loadMore } = usePagination(artworks, 6);

  useEffect(() => {
    void Promise.all([loadArtworks(), loadArtists(), loadExhibitions()]);
  }, [loadArtworks, loadArtists, loadExhibitions]);

  const featured = exhibitions[0];
  const findArtist = (id: string) => artists.find((artist) => artist.id === id);

  return (
    <main className="page-shell">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/gallery" className="font-display text-2xl">Atelier Index</Link>
        <nav className="flex gap-5 text-sm text-ink/70">
          <Link to="/gallery">画廊</Link>
          <Link to="/studio">工作台</Link>
        </nav>
      </header>
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="pt-8">
            <p className="text-sm uppercase tracking-[0.25em] text-clay">Independent gallery system</p>
            <h1 className="mt-4 font-display text-6xl leading-[0.95] text-ink md:text-7xl">作品、展览与观众互动在同一个现场。</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink/70">为独立艺术家和小型画廊准备的管理平台：从作品发布、展览策划到点赞评论，都保持在可审核、可追踪的工作流里。</p>
          </div>
          {featured ? <ExhibitionBanner exhibition={featured} large /> : <EmptyState title="暂无展览" description="创建第一个展览后会出现在这里。" />}
        </div>
        <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_280px]">
          <section>
            <div className="mb-5 flex items-end justify-between">
              <h2 className="font-display text-4xl">最新作品</h2>
              <span className="text-sm text-ink/55">{artworks.length} 件作品</span>
            </div>
            {visibleItems.length ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visibleItems.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} artist={findArtist(artwork.artistId)} />)}
              </div>
            ) : (
              <EmptyState title="作品库为空" description="上传作品后将自动生成瀑布流展示。" />
            )}
            {hasMore && <button onClick={loadMore} className="mt-8 border border-ink px-5 py-3 text-sm hover:bg-ink hover:text-rice">加载更多</button>}
          </section>
          <aside className="border-l border-ink/15 pl-6">
            <h2 className="font-display text-3xl">热门排行</h2>
            <div className="mt-5 space-y-4">
              {[...artworks].sort((a, b) => b.likes - a.likes).map((artwork, index) => (
                <Link key={artwork.id} to={`/artwork/${artwork.id}`} className="grid grid-cols-[32px_1fr] gap-3 border-b border-ink/10 pb-4">
                  <span className="font-display text-3xl text-clay">{index + 1}</span>
                  <span>
                    <span className="block font-semibold">{artwork.title}</span>
                    <span className="text-sm text-ink/55">{artwork.views.toLocaleString()} views</span>
                  </span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
