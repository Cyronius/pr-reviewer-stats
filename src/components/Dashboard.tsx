import React, { useState, useEffect, useCallback } from 'react';
import { PRRecord, ProcessedData, RangeKey, Stats } from '../types';
import { COLORS, TEAM_COLOR, RANGES } from '../utils/constants';
import { parseCSV, filterByRange, processData, getStats } from '../utils/dataProcessing';
import { FileInput } from './FileInput';
import { TimeRangeSelector } from './TimeRangeSelector';
import { ContributorChips } from './ContributorChips';
import { StatCard } from './StatCard';
import { VelocityChart } from './VelocityChart';
import { LeaderboardCard } from './LeaderboardCard';

export const Dashboard: React.FC = () => {
  const [allRecords, setAllRecords] = useState<PRRecord[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeKey>('all');
  const [smoothingEnabled, setSmoothingEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback((text: string) => {
    try {
      const records = parseCSV(text);
      if (records.length === 0) {
        setError('No data found in CSV file');
        return;
      }
      setAllRecords(records);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      setError(`Error parsing CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  useEffect(() => {
    fetch('pr-velocity.csv')
      .then(response => {
        if (!response.ok) throw new Error('File not found');
        return response.text();
      })
      .then(text => loadData(text))
      .catch(() => {
        setIsLoading(false);
      });
  }, [loadData]);

  const handleFileLoad = (content: string) => {
    loadData(content);
  };

  const handleAuthorSelect = (author: string | null) => {
    setSelectedAuthor(author === '' ? null : author);
  };

  const filteredRecords = filterByRange(allRecords, RANGES[selectedRange].days);
  const data: ProcessedData = processData(filteredRecords);
  const stats: Stats = getStats(filteredRecords, selectedAuthor);

  const selectedAuthorIndex = selectedAuthor ? data.authorList.indexOf(selectedAuthor) : -1;
  const selectedColor = selectedAuthor
    ? COLORS[selectedAuthorIndex % COLORS.length]
    : TEAM_COLOR;

  const contributorItems = Object.entries(data.byAuthor)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const projectItems = Object.entries(data.byProject)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return (
    <div className="container">
      <h1>PR Velocity Dashboard</h1>

      <FileInput onFileLoad={handleFileLoad} />

      {isLoading && <div className="loading">Loading data...</div>}
      {error && <div className="error">{error}</div>}

      {!isLoading && !error && allRecords.length > 0 && (
        <>
          <div className="controls-row">
            <TimeRangeSelector
              selectedRange={selectedRange}
              onRangeSelect={setSelectedRange}
            />
            <ContributorChips
              authorList={data.authorList}
              selectedAuthor={selectedAuthor}
              onAuthorSelect={handleAuthorSelect}
            />
          </div>

          <div className="stats-row" style={{ '--kpi-color': selectedColor } as React.CSSProperties}>
            <StatCard
              title="PRs Completed"
              value={stats.total}
              subtitle={selectedAuthor || 'Team Total'}
            />
            <StatCard
              title="Avg PRs / Week"
              value={stats.avgPerWeek}
              subtitle={selectedAuthor || 'Team Average'}
            />
            <StatCard
              title={selectedAuthor ? 'Contributor' : 'Top Contributor'}
              value={stats.topContributor}
              subtitle={selectedAuthor ? 'Selected' : 'Most PRs'}
            />
            <StatCard
              title="Time Period"
              value={stats.weeks}
              subtitle="weeks"
            />
          </div>

          <VelocityChart
            data={data}
            selectedAuthor={selectedAuthor}
            selectedRange={selectedRange}
            smoothingEnabled={smoothingEnabled}
            onToggleSmoothing={() => setSmoothingEnabled(!smoothingEnabled)}
          />

          <div className="leaderboard">
            <LeaderboardCard
              title="PRs by Contributor"
              items={contributorItems}
              selectedItem={selectedAuthor}
              onItemClick={handleAuthorSelect}
              showTeamTotal
              teamTotal={data.totalPRs}
            />
            <LeaderboardCard
              title="PRs by Project"
              items={projectItems}
            />
          </div>
        </>
      )}
    </div>
  );
};
