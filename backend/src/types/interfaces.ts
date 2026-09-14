export type UserRole = 'Admin' | 'Curator' | 'Artist' | 'Viewer';

export interface RequestUser {
  id: string;
  role: UserRole;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
