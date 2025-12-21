export interface PRRecord {
  author: string;
  authorEmail: string;
  project: string;
  repository: string;
  closedDate: string;
  prId: number;
  title: string;
  linesAdded: number;
  linesDeleted: number;
}

export type DashboardMode = 'velocity' | 'impact';

export interface ProcessedData {
  byDay: Record<string, Record<string, number> & { total: number }>;
  byAuthor: Record<string, number>;
  byProject: Record<string, number>;
  days: string[];
  authorList: string[];
  totalPRs: number;
}

export interface ImpactData {
  byDay: Record<string, Record<string, { added: number; deleted: number }> & { totalAdded: number; totalDeleted: number }>;
  byAuthor: Record<string, { added: number; deleted: number }>;
  byProject: Record<string, { added: number; deleted: number }>;
  days: string[];
  authorList: string[];
  totalLinesAdded: number;
  totalLinesDeleted: number;
}

export interface ImpactStats {
  totalAdded: number;
  totalDeleted: number;
  netChange: number;
  avgPerWeek: string;
  topContributor: string;
  weeks: number;
}

export interface Stats {
  total: number;
  avgPerWeek: string;
  topContributor: string;
  weeks: number;
}

export interface TimeRange {
  label: string;
  days: number | null;
  smoothing: number;
  smoothingLabel: string;
}

export type RangeKey = 'week' | 'month' | '3months' | 'year' | 'all';
