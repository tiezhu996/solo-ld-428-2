import { Navigate } from 'react-router-dom';

type Role = 'Admin' | 'Curator' | 'Artist' | 'Viewer';

const currentRole: Role = 'Artist';

export function RequireRole({ allow, children }: { allow: Role[]; children: JSX.Element }) {
  if (!allow.includes(currentRole)) {
    return <Navigate to="/gallery" replace />;
  }
  return children;
}
