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
  showTeamTotal?: boolean;
  teamTotal?: number;
  formatValue?: (value: number) => string;
}

export const LeaderboardCard: React.FC<LeaderboardCardProps> = ({
  title,
  items,
  selectedItem,
  onItemClick,
  showTeamTotal = false,
  teamTotal = 0,
  formatValue
}) => {
  const isClickable = !!onItemClick;
  const displayValue = (value: number) => formatValue ? formatValue(value) : value;

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
          <span className="count">{displayValue(count)}</span>
        </div>
      ))}
    </div>
  );
};
