import { Link, useParams } from 'react-router-dom';

import { ArtworkCard } from '../components/common/ArtworkCard';
import { ExhibitionBanner } from '../components/common/ExhibitionBanner';
import { StatusBadge } from '../components/common/StatusBadge';
import { UserAvatar } from '../components/common/UserAvatar';
import { useArtistStore } from '../stores/artistStore';
import { useArtworkStore } from '../stores/artworkStore';
import { useExhibitionStore } from '../stores/exhibitionStore';
import { useEffect } from 'react';

export function ArtistProfile() {
  const { id = '' } = useParams();
  const { artists, loadArtists } = useArtistStore();
  const { artworks, loadArtworks } = useArtworkStore();
  const { exhibitions, loadExhibitions } = useExhibitionStore();

  useEffect(() => {
    void Promise.all([loadArtists(), loadArtworks(), loadExhibitions()]);
  }, [loadArtists, loadArtworks, loadExhibitions]);

  const artist = artists.find((item) => item.id === id);
  const artistArtworks = artworks.filter((item) => item.artistId === id);
  const artistExhibitions = exhibitions.filter((item) => item.curatorId === id || item.artworkIds.some((artId) => artistArtworks.some((art) => art.id === artId)));

  if (!artist) return <main className="page-shell p-10">艺术家不存在</main>;

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <Link to="/gallery" className="text-sm text-ink/60 hover:text-clay">返回画廊</Link>
        <section className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="border-r border-ink/15 pr-8">
            <UserAvatar artist={artist} size="lg" />
            <div className="mt-5"><StatusBadge status={artist.status} /></div>
            <p className="mt-6 text-lg leading-8 text-ink/70">{artist.bio}</p>
            <div className="mt-8 flex gap-10">
              <div><p className="font-display text-4xl">{artist.followerCount}</p><p className="text-sm text-ink/55">粉丝</p></div>
              <div><p className="font-display text-4xl">{artist.followingCount}</p><p className="text-sm text-ink/55">关注</p></div>
            </div>
          </aside>
          <div>
            <h1 className="font-display text-6xl">{artist.artistName}</h1>
            <div className="mt-5 flex flex-wrap gap-2">
              {artist.mediums.map((medium) => <span key={medium} className="bg-ink px-3 py-1 text-xs text-rice">{medium}</span>)}
            </div>
            <section className="mt-10">
              <h2 className="font-display text-3xl">作品集</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {artistArtworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} artist={artist} />)}
              </div>
            </section>
            <section className="mt-12 space-y-5">
              <h2 className="font-display text-3xl">参与展览</h2>
              {artistExhibitions.map((exhibition) => <ExhibitionBanner key={exhibition.id} exhibition={exhibition} />)}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
