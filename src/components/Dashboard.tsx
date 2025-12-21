import React, { useState, useEffect, useCallback } from 'react';
import { PRRecord, ProcessedData, RangeKey, Stats, DashboardMode, ImpactData, ImpactStats } from '../types';
import { COLORS, TEAM_COLOR, RANGES } from '../utils/constants';
import { parseCSV, filterByRange, processData, getStats, processImpactData, getImpactStats, formatNumber, removeOutliers } from '../utils/dataProcessing';
import { FileInput } from './FileInput';
import { TimeRangeSelector } from './TimeRangeSelector';
import { ContributorChips } from './ContributorChips';
import { StatCard } from './StatCard';
import { VelocityChart } from './VelocityChart';
import { LeaderboardCard } from './LeaderboardCard';
import { ModeSelector } from './ModeSelector';

export const Dashboard: React.FC = () => {
  const [allRecords, setAllRecords] = useState<PRRecord[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeKey>('all');
  const [smoothingEnabled, setSmoothingEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DashboardMode>('velocity');

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
  // Remove top 1% outliers for impact mode to prevent extreme values from skewing visualizations
  const filteredRecordsForImpact = removeOutliers(filteredRecords, 99);

  const data: ProcessedData = processData(filteredRecords);
  const impactData: ImpactData = processImpactData(filteredRecordsForImpact);
  const stats: Stats = getStats(filteredRecords, selectedAuthor);
  const impactStats: ImpactStats = getImpactStats(filteredRecordsForImpact, selectedAuthor);

  // Use impact data's author list when in impact mode (sorted by LOC)
  const activeAuthorList = mode === 'impact' ? impactData.authorList : data.authorList;

  const selectedAuthorIndex = selectedAuthor ? activeAuthorList.indexOf(selectedAuthor) : -1;
  const selectedColor = selectedAuthor
    ? COLORS[selectedAuthorIndex % COLORS.length]
    : TEAM_COLOR;

  const contributorItems = mode === 'velocity'
    ? Object.entries(data.byAuthor)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }))
    : Object.entries(impactData.byAuthor)
        .sort((a, b) => (b[1].added + b[1].deleted) - (a[1].added + a[1].deleted))
        .map(([name, loc]) => ({ name, count: loc.added + loc.deleted }));

  const projectItems = mode === 'velocity'
    ? Object.entries(data.byProject)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }))
    : Object.entries(impactData.byProject)
        .sort((a, b) => (b[1].added + b[1].deleted) - (a[1].added + a[1].deleted))
        .map(([name, loc]) => ({ name, count: loc.added + loc.deleted }));

  const totalForLeaderboard = mode === 'velocity'
    ? data.totalPRs
    : impactData.totalLinesAdded + impactData.totalLinesDeleted;

  return (
    <div className="container">
      <div className="top-bar">
        <ModeSelector mode={mode} onModeChange={setMode} />
        <FileInput onFileLoad={handleFileLoad} />
      </div>

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
              authorList={activeAuthorList}
              selectedAuthor={selectedAuthor}
              onAuthorSelect={handleAuthorSelect}
            />
          </div>

          <div className="stats-row" style={{ '--kpi-color': selectedColor } as React.CSSProperties}>
            {mode === 'velocity' ? (
              <>
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
              </>
            ) : (
              <>
                <StatCard
                  title="Lines Added"
                  value={formatNumber(impactStats.totalAdded)}
                  subtitle={selectedAuthor || 'Team Total'}
                />
                <StatCard
                  title="Lines Deleted"
                  value={formatNumber(impactStats.totalDeleted)}
                  subtitle={selectedAuthor || 'Team Total'}
                />
                <StatCard
                  title="Net Change"
                  value={formatNumber(impactStats.netChange)}
                  subtitle={selectedAuthor || 'Team Total'}
                />
                <StatCard
                  title={selectedAuthor ? 'Contributor' : 'Top Contributor'}
                  value={impactStats.topContributor}
                  subtitle={selectedAuthor ? 'Selected' : 'Most Impact'}
                />
              </>
            )}
          </div>

          <VelocityChart
            data={data}
            impactData={impactData}
            mode={mode}
            selectedAuthor={selectedAuthor}
            selectedRange={selectedRange}
            smoothingEnabled={smoothingEnabled}
            onToggleSmoothing={() => setSmoothingEnabled(!smoothingEnabled)}
          />

          <div className="leaderboard">
            <LeaderboardCard
              title={mode === 'velocity' ? 'PRs by Contributor' : 'Lines Changed by Contributor'}
              items={contributorItems}
              selectedItem={selectedAuthor}
              onItemClick={handleAuthorSelect}
              showTeamTotal
              teamTotal={totalForLeaderboard}
              formatValue={mode === 'impact' ? formatNumber : undefined}
            />
            <LeaderboardCard
              title={mode === 'velocity' ? 'PRs by Project' : 'Lines Changed by Project'}
              items={projectItems}
              formatValue={mode === 'impact' ? formatNumber : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
};
