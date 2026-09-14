import { ExhibitionStatus, ExhibitionType } from './enums';

export interface Exhibition {
  id: string;
  title: string;
  description: string;
  curatorId: string;
  startDate: string;
  endDate: string;
  type: ExhibitionType;
  coverUrl: string;
  artworkIds: string[];
  status: ExhibitionStatus;
  visitors: number;
}
