import type { ApiResponse } from '../types/interfaces';

export function ok<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { data, message };
}
