import React from 'react';

interface LeaderboardItem {
  name: string;
  count: number;
}

interface LeaderboardCardProps {
  title: string;
  items: LeaderboardItem[];
  selectedItem?: string | null;
  onItemClick?: (name: string) => void;
  onDrillDown?: (name: string) => void;
  showTeamTotal?: boolean;
  teamTotal?: number;
  formatValue?: (value: number) => string;
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({
  title,
  items,
  selectedItem,
  onItemClick,
  onDrillDown,
  showTeamTotal = false,
  teamTotal = 0,
  formatValue
}) => {
  const isClickable = !!onItemClick;
  const hasDrillDown = !!onDrillDown;
  const displayValue = (value: number) => formatValue ? formatValue(value) : value;

  const handleDrillDownClick = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    onDrillDown?.(name);
  };

  return (
    <div className="leaderboard-card">
      <h3>{title}</h3>
      {showTeamTotal && (
        <div
          className={`leaderboard-item ${selectedItem === null ? 'selected' : ''}`}
          onClick={() => onItemClick?.('')}
        >
          <span className="name">All Team</span>
          <span className="count">{displayValue(teamTotal)}</span>
        </div>
      )}
      {items.map(({ name, count }) => (
        <div
          key={name}
          className={`leaderboard-item ${selectedItem === name ? 'selected' : ''} ${!isClickable ? 'non-clickable' : ''}`}
          onClick={() => onItemClick?.(name)}
        >
          <span className="name">{name}</span>
          <span className="count">
            {displayValue(count)}
            {hasDrillDown && (
              <button
                className="drill-down-icon"
                onClick={(e) => handleDrillDownClick(e, name)}
                title={`View PRs by ${name}`}
                aria-label={`View PRs by ${name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};
