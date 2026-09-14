import { Navigate, createBrowserRouter } from 'react-router-dom';

import { ArtistProfile } from '../pages/ArtistProfile';
import { ArtworkDetail } from '../pages/ArtworkDetail';
import { ExhibitionDetail } from '../pages/ExhibitionDetail';
import { Gallery } from '../pages/Gallery';
import { Studio } from '../pages/Studio';
import { RequireRole } from './guards';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/gallery" replace /> },
  { path: '/gallery', element: <Gallery /> },
  { path: '/artwork/:id', element: <ArtworkDetail /> },
  { path: '/exhibition/:id', element: <ExhibitionDetail /> },
  { path: '/artist/:id', element: <ArtistProfile /> },
  {
    path: '/studio',
    element: (
      <RequireRole allow={['Admin', 'Curator', 'Artist']}>
        <Studio />
      </RequireRole>
    ),
  },
]);
