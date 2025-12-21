import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ProcessedData, RangeKey } from '../types';
import { COLORS, TEAM_COLOR, RANGES } from '../utils/constants';
import { calculateMovingAverage } from '../utils/dataProcessing';

Chart.register(...registerables);

interface VelocityChartProps {
  data: ProcessedData;
  selectedAuthor: string | null;
  selectedRange: RangeKey;
  smoothingEnabled: boolean;
  onToggleSmoothing: () => void;
}

export const VelocityChart: React.FC<VelocityChartProps> = ({
  data,
  selectedAuthor,
  selectedRange,
  smoothingEnabled,
  onToggleSmoothing
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const smoothingWindow = smoothingEnabled ? RANGES[selectedRange].smoothing : 1;
  const smoothingLabel = RANGES[selectedRange].smoothingLabel;

  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const { byDay, days, authorList } = data;
    const datasets: Chart['data']['datasets'] = [];

    const selectedAuthorIndex = selectedAuthor ? authorList.indexOf(selectedAuthor) : -1;
    const selectedColor = selectedAuthor
      ? COLORS[selectedAuthorIndex % COLORS.length]
      : TEAM_COLOR;

    if (selectedAuthor) {
      const authorData = days.map(d => byDay[d]?.[selectedAuthor] || 0);
      const smoothedAuthor = calculateMovingAverage(authorData, smoothingWindow);

      datasets.push({
        label: selectedAuthor,
        data: smoothedAuthor,
        borderColor: selectedColor,
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: smoothingWindow === 1 ? 2 : 0,
        pointHoverRadius: 5
      });
    } else {
      const teamData = days.map(d => byDay[d]?.total || 0);
      const smoothedTeam = calculateMovingAverage(teamData, smoothingWindow);

      datasets.push({
        label: 'Team Total',
        data: smoothedTeam,
        borderColor: TEAM_COLOR,
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: smoothingWindow === 1 ? 2 : 0,
        pointHoverRadius: 5
      });

      authorList.forEach((author, idx) => {
        const authorData = days.map(d => byDay[d]?.[author] || 0);
        const smoothedAuthor = calculateMovingAverage(authorData, smoothingWindow);

        datasets.push({
          label: author,
          data: smoothedAuthor,
          borderColor: COLORS[idx % COLORS.length],
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: smoothingWindow === 1 ? 1 : 0,
          pointHoverRadius: 4,
          hidden: false
        });
      });
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(1)} PRs`
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'PRs per Week'
            }
          }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data, selectedAuthor, selectedRange, smoothingEnabled, smoothingWindow]);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2>PR Velocity Over Time</h2>
        <div className="chart-header-controls">
          <span className="chart-note">
            {smoothingEnabled && smoothingWindow > 1
              ? `${smoothingLabel} applied`
              : 'showing raw daily data'}
          </span>
          <button
            className={`btn small ${smoothingEnabled ? 'active' : ''}`}
            onClick={onToggleSmoothing}
          >
            {smoothingEnabled ? 'Smoothing On' : 'Smoothing Off'}
          </button>
        </div>
      </div>
      <div className="chart-wrapper">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
};
