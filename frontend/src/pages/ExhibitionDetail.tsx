import { Link, useParams } from 'react-router-dom';

import { ArtworkCard } from '../components/common/ArtworkCard';
import { ExhibitionBanner } from '../components/common/ExhibitionBanner';
import { UserAvatar } from '../components/common/UserAvatar';
import { useArtistStore } from '../stores/artistStore';
import { useArtworkStore } from '../stores/artworkStore';
import { useExhibitionStore } from '../stores/exhibitionStore';
import { useEffect } from 'react';

export function ExhibitionDetail() {
  const { id = '' } = useParams();
  const { exhibitions, loadExhibitions } = useExhibitionStore();
  const { artworks, loadArtworks } = useArtworkStore();
  const { artists, loadArtists } = useArtistStore();

  useEffect(() => {
    void Promise.all([loadExhibitions(), loadArtworks(), loadArtists()]);
  }, [loadExhibitions, loadArtworks, loadArtists]);

  const exhibition = exhibitions.find((item) => item.id === id);
  const curator = exhibition ? artists.find((artist) => artist.id === exhibition.curatorId) : undefined;
  const exhibitionArtworks = exhibition ? artworks.filter((artwork) => exhibition.artworkIds.includes(artwork.id)) : [];

  if (!exhibition) return <main className="page-shell p-10">展览不存在</main>;

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <Link to="/gallery" className="text-sm text-ink/60 hover:text-clay">返回画廊</Link>
        <div className="mt-6"><ExhibitionBanner exhibition={exhibition} large /></div>
        <section className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside>
            <p className="text-sm uppercase tracking-[0.2em] text-ink/45">Curator</p>
            {curator && <div className="mt-4"><UserAvatar artist={curator} /></div>}
            <p className="mt-6 text-sm leading-7 text-ink/65">{exhibition.visitors.toLocaleString()} 位线上观众访问了本展。</p>
          </aside>
          <div>
            <h2 className="font-display text-4xl">展出作品</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {exhibitionArtworks.map((artwork) => (
                <ArtworkCard key={artwork.id} artwork={artwork} artist={artists.find((artist) => artist.id === artwork.artistId)} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
