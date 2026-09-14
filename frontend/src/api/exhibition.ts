import { apiPaths } from '../constants/apiPaths';
import { exhibitions } from '../utils/mockData';
import { request } from '../utils/request';
import type { Exhibition } from '../types/exhibition';

export async function fetchExhibitions(): Promise<Exhibition[]> {
  try {
    return await request<Exhibition[]>(apiPaths.exhibitions);
  } catch {
    return exhibitions;
  }
}

export async function fetchExhibition(id: string): Promise<Exhibition | undefined> {
  const list = await fetchExhibitions();
  return list.find((exhibition) => exhibition.id === id);
}
