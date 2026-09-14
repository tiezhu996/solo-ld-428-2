import { Link } from 'react-router-dom';

import type { Exhibition } from '../../types/exhibition';
import { StatusBadge } from './StatusBadge';

export function ExhibitionBanner({ exhibition, large = false }: { exhibition: Exhibition; large?: boolean }) {
  return (
    <Link to={`/exhibition/${exhibition.id}`} className="group grid overflow-hidden bg-ink text-rice md:grid-cols-[1.2fr_0.8fr]">
      <img className={`${large ? 'h-[420px]' : 'h-72'} w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03]`} src={exhibition.coverUrl} alt={exhibition.title} />
      <div className="flex flex-col justify-between p-6 md:p-8">
        <StatusBadge status={exhibition.status} />
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-rice/60">{exhibition.type}</p>
          <h2 className="mt-3 font-display text-4xl leading-tight">{exhibition.title}</h2>
          <p className="mt-4 text-rice/75">{exhibition.description}</p>
          <p className="mt-6 text-sm text-rice/60">{exhibition.startDate} - {exhibition.endDate}</p>
        </div>
      </div>
    </Link>
  );
}
