import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle }) => {
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <div className="value">{value}</div>
      <div className="subtitle">{subtitle}</div>
    </div>
  );
};
