import React, { useState, useEffect, useCallback } from 'react';
import { PRRecord, ProcessedData, RangeKey, Stats, DashboardMode, ImpactData, ImpactStats } from '../types';
import { COLORS, TEAM_COLOR, RANGES } from '../utils/constants';
import { parseCSV, filterByRange, processData, getStats, processImpactData, getImpactStats, formatNumber, removeOutliers } from '../utils/dataProcessing';
import { TimeRangeSelector } from './TimeRangeSelector';
import { ContributorChips } from './ContributorChips';
import { StatCard } from './StatCard';
import { VelocityChart } from './VelocityChart';
import { LeaderboardCard } from './LeaderboardCard';
import { ModeSelector } from './ModeSelector';
import { RefreshButton } from './RefreshButton';
import { ContributorModal } from './ContributorModal';

const AZURE_DEVOPS_ORG = 'itkennel';

export const Dashboard: React.FC = () => {
  const [allRecords, setAllRecords] = useState<PRRecord[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeKey>('all');
  const [smoothingWindow, setSmoothingWindow] = useState<number>(() => RANGES[selectedRange].smoothing);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DashboardMode>('velocity');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingRepo, setRefreshingRepo] = useState<string | null>(null);
  const [modalAuthor, setModalAuthor] = useState<string | null>(null);
  const [hasPAT, setHasPAT] = useState(true); // assume true initially to avoid flicker

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
    // Check if server has PAT configured (with retry for server startup)
    const checkStatus = async (retries = 5) => {
      try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error('Status check failed');
        const status = await response.json();
        setHasPAT(status.hasPAT);
      } catch {
        if (retries > 0) {
          setTimeout(() => checkStatus(retries - 1), 1000);
        } else {
          setHasPAT(false);
        }
      }
    };
    checkStatus();

    // Try to load existing CSV data
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

  const handleAuthorSelect = (author: string | null) => {
    setSelectedAuthor(author === '' ? null : author);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshingRepo(null);
    setError(null);

    try {
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withLoc: true })
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let csvContent = '';
      let buffer = '';
      let serverError: string | null = null;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'progress') {
                setRefreshingRepo(data.repo);
              } else if (data.type === 'complete') {
                csvContent = data.csv;
              } else if (data.type === 'error') {
                serverError = data.message;
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }

      if (serverError) {
        throw new Error(serverError);
      }

      if (csvContent) {
        loadData(csvContent);
      }
    } catch (err) {
      setError(`Refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRefreshing(false);
      setRefreshingRepo(null);
    }
  };

  const handleDrillDown = (author: string) => {
    setModalAuthor(author);
  };

  const filteredRecords = filterByRange(allRecords, RANGES[selectedRange].days);

  // Check if LOC data exists
  const hasLOCData = allRecords.some(r => r.linesAdded > 0 || r.linesDeleted > 0);

  // Get PRs for modal, sorted by date descending
  const modalPRs = modalAuthor
    ? filteredRecords
        .filter(r => r.author === modalAuthor)
        .sort((a, b) => b.closedDate.localeCompare(a.closedDate))
    : [];
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
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '12px' }}>
          <ModeSelector mode={mode} onModeChange={setMode} />
          <RefreshButton onRefresh={handleRefresh} isRefreshing={isRefreshing} disabled={!hasPAT} currentRepo={refreshingRepo} />
        </div>
      </div>

      {isLoading && <div className="loading">Loading data...</div>}
      {error && <div className="error">{error}</div>}

      {!isLoading && !error && allRecords.length > 0 && (
        <>
          {mode === 'impact' && !hasLOCData && (
            <div className="info-bar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div className="info-bar-content">
                <div className="info-bar-title">Impact data not available</div>
                <div className="info-bar-message">
                  Lines of code data was not captured. Click <strong>Refresh</strong> to fetch data with LOC tracking.
                </div>
              </div>
            </div>
          )}
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
            smoothingWindow={smoothingWindow}
            onSmoothingChange={setSmoothingWindow}
          />

          <div className="leaderboard">
            <LeaderboardCard
              title={mode === 'velocity' ? 'PRs by Contributor' : 'Lines Changed by Contributor'}
              items={contributorItems}
              selectedItem={selectedAuthor}
              onItemClick={handleAuthorSelect}
              onDrillDown={handleDrillDown}
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

      {modalAuthor && (
        <ContributorModal
          author={modalAuthor}
          prs={modalPRs}
          org={AZURE_DEVOPS_ORG}
          onClose={() => setModalAuthor(null)}
        />
      )}
    </div>
  );
};
