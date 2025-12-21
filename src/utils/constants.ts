import { RangeKey, TimeRange } from '../types';

export const COLORS = [
  '#0078d4', '#00bcf2', '#00b294', '#bad80a', '#ff8c00',
  '#e81123', '#5c2d91', '#0063b1', '#107c10', '#ffb900',
  '#ea4300', '#b4009e', '#00188f', '#68768a', '#004e8c'
];

export const TEAM_COLOR = '#333';

export const RANGES: Record<RangeKey, TimeRange> = {
  'week': { label: 'Past Week', days: 7, smoothing: 1, smoothingLabel: 'no smoothing' },
  'month': { label: 'Past Month', days: 30, smoothing: 3, smoothingLabel: '3-day moving average' },
  '3months': { label: 'Past 3 Months', days: 90, smoothing: 5, smoothingLabel: '5-day moving average' },
  'year': { label: 'Past Year', days: 365, smoothing: 7, smoothingLabel: '7-day moving average' },
  'all': { label: 'All Time', days: null, smoothing: 30, smoothingLabel: '30-day moving average' }
};
