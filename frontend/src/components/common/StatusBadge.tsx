import { ArtworkStatus, ExhibitionStatus } from '../../types/enums';

const toneMap: Record<string, string> = {
  [ArtworkStatus.Published]: 'bg-moss text-rice',
  [ArtworkStatus.Draft]: 'bg-rice text-ink border border-ink/20',
  [ArtworkStatus.Sold]: 'bg-clay text-rice',
  [ArtworkStatus.Archived]: 'bg-ink/10 text-ink',
  [ExhibitionStatus.Active]: 'bg-lapis text-rice',
  [ExhibitionStatus.Planning]: 'bg-rice text-ink border border-ink/20',
  [ExhibitionStatus.Ended]: 'bg-ink text-rice',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneMap[status] ?? 'bg-ink/10 text-ink'}`}>{status}</span>;
}
