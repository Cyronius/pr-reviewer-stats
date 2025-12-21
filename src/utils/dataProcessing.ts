import { PRRecord, ProcessedData, Stats } from '../types';

export function parseCSV(text: string): PRRecord[] {
  const lines = text.trim().split('\n');
  const records: PRRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    if (values.length >= 5) {
      records.push({
        author: values[0],
        authorEmail: values[1],
        project: values[2],
        repository: values[3],
        closedDate: values[4],
        prId: parseInt(values[5]) || 0,
        title: values[6] || ''
      });
    }
  }

  return records;
}

export function filterByRange(records: PRRecord[], rangeDays: number | null): PRRecord[] {
  if (!rangeDays) return records;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return records.filter(r => r.closedDate >= cutoffStr);
}

export function processData(records: PRRecord[]): ProcessedData {
  const byDay: Record<string, Record<string, number> & { total: number }> = {};
  const byAuthor: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const authors = new Set<string>();

  for (const r of records) {
    const day = r.closedDate;

    authors.add(r.author);

    if (!byDay[day]) {
      byDay[day] = { total: 0 } as Record<string, number> & { total: number };
    }
    if (!byDay[day][r.author]) byDay[day][r.author] = 0;
    byDay[day][r.author]++;
    byDay[day].total++;

    byAuthor[r.author] = (byAuthor[r.author] || 0) + 1;
    byProject[r.project] = (byProject[r.project] || 0) + 1;
  }

  // Fill in missing days with zeros for continuous data
  const days = Object.keys(byDay).sort();
  if (days.length > 1) {
    const startDate = new Date(days[0]);
    const endDate = new Date(days[days.length - 1]);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      if (!byDay[dayStr]) {
        byDay[dayStr] = { total: 0 } as Record<string, number> & { total: number };
      }
    }
  }

  const allDays = Object.keys(byDay).sort();
  const authorList = Array.from(authors).sort((a, b) => byAuthor[b] - byAuthor[a]);

  return { byDay, byAuthor, byProject, days: allDays, authorList, totalPRs: records.length };
}

export function calculateMovingAverage(data: number[], windowSize: number = 1): number[] {
  if (windowSize <= 1) return data;

  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;

    for (let j = i - halfWindow; j <= i + halfWindow; j++) {
      if (j >= 0 && j < data.length && data[j] !== null && data[j] !== undefined) {
        sum += data[j];
        count++;
      }
    }
    result.push(count > 0 ? sum / count : 0);
  }
  return result;
}

export function getStats(records: PRRecord[], author: string | null): Stats {
  const filtered = author ? records.filter(r => r.author === author) : records;
  const total = filtered.length;

  if (total === 0) {
    return { total: 0, avgPerWeek: '0', topContributor: 'N/A', weeks: 0 };
  }

  const dates = filtered.map(r => r.closedDate).sort();
  const firstDate = new Date(dates[0]);
  const lastDate = new Date(dates[dates.length - 1]);
  const weekSpan = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));

  const avgPerWeek = (total / weekSpan).toFixed(1);

  let topContributor = author || 'N/A';
  if (!author) {
    const byAuthor: Record<string, number> = {};
    for (const r of filtered) {
      byAuthor[r.author] = (byAuthor[r.author] || 0) + 1;
    }
    const top = Object.entries(byAuthor).sort((a, b) => b[1] - a[1])[0];
    topContributor = top ? top[0] : 'N/A';
  }

  return { total, avgPerWeek, topContributor, weeks: weekSpan };
}

export function getFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}
