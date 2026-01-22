import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ProcessedData, RangeKey, ImpactData, DashboardMode } from '../types';
import { COLORS, TEAM_COLOR } from '../utils/constants';
import { calculateMovingAverage } from '../utils/dataProcessing';

Chart.register(...registerables);

const SMOOTHING_OPTIONS = [
  { value: 1, label: 'None' },
  { value: 3, label: '3 days' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

interface VelocityChartProps {
  data: ProcessedData;
  impactData: ImpactData;
  mode: DashboardMode;
  selectedAuthor: string | null;
  selectedRange: RangeKey;
  smoothingWindow: number;
  onSmoothingChange: (window: number) => void;
}

export const VelocityChart: React.FC<VelocityChartProps> = ({
  data,
  impactData,
  mode,
  selectedAuthor,
  selectedRange,
  smoothingWindow,
  onSmoothingChange
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const datasets: Chart['data']['datasets'] = [];

    if (mode === 'velocity') {
      // Velocity mode - show PR counts
      const { byDay, days, authorList } = data;

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
    } else {
      // Impact mode - show lines of code
      const { byDay, days, authorList } = impactData;

      const selectedAuthorIndex = selectedAuthor ? authorList.indexOf(selectedAuthor) : -1;
      const selectedColor = selectedAuthor
        ? COLORS[selectedAuthorIndex % COLORS.length]
        : TEAM_COLOR;

      if (selectedAuthor) {
        // Show added, deleted, and combined lines for selected author
        const addedData = days.map(d => {
          const dayData = byDay[d]?.[selectedAuthor];
          return dayData ? (dayData as { added: number; deleted: number }).added : 0;
        });
        const deletedData = days.map(d => {
          const dayData = byDay[d]?.[selectedAuthor];
          return dayData ? (dayData as { added: number; deleted: number }).deleted : 0;
        });
        const combinedData = days.map((_, i) => addedData[i] + deletedData[i]);

        const smoothedAdded = calculateMovingAverage(addedData, smoothingWindow);
        const smoothedDeleted = calculateMovingAverage(deletedData, smoothingWindow);
        const smoothedCombined = calculateMovingAverage(combinedData, smoothingWindow);

        datasets.push({
          label: `${selectedAuthor} (Total Changed)`,
          data: smoothedCombined,
          borderColor: '#3b82f6',
          backgroundColor: 'transparent',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: smoothingWindow === 1 ? 2 : 0,
          pointHoverRadius: 5,
          fill: false
        });

        datasets.push({
          label: `${selectedAuthor} (Added)`,
          data: smoothedAdded,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: smoothingWindow === 1 ? 2 : 0,
          pointHoverRadius: 5,
          fill: true
        });

        datasets.push({
          label: `${selectedAuthor} (Deleted)`,
          data: smoothedDeleted,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: smoothingWindow === 1 ? 2 : 0,
          pointHoverRadius: 5,
          fill: true
        });
      } else {
        // Show team totals
        const addedData = days.map(d => byDay[d]?.totalAdded || 0);
        const deletedData = days.map(d => byDay[d]?.totalDeleted || 0);
        const combinedData = days.map((_, i) => addedData[i] + deletedData[i]);

        const smoothedAdded = calculateMovingAverage(addedData, smoothingWindow);
        const smoothedDeleted = calculateMovingAverage(deletedData, smoothingWindow);
        const smoothedCombined = calculateMovingAverage(combinedData, smoothingWindow);

        datasets.push({
          label: 'Total Changed',
          data: smoothedCombined,
          borderColor: '#3b82f6',
          backgroundColor: 'transparent',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: smoothingWindow === 1 ? 2 : 0,
          pointHoverRadius: 5,
          fill: false
        });

        datasets.push({
          label: 'Lines Added',
          data: smoothedAdded,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: smoothingWindow === 1 ? 2 : 0,
          pointHoverRadius: 5,
          fill: true
        });

        datasets.push({
          label: 'Lines Deleted',
          data: smoothedDeleted,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: smoothingWindow === 1 ? 2 : 0,
          pointHoverRadius: 5,
          fill: true
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
              display: true,
              position: 'top'
            },
            tooltip: {
              callbacks: {
                label: (context) => `${context.dataset.label}: ${Math.round(context.parsed.y ?? 0).toLocaleString()} lines`
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
                text: 'Lines of Code'
              }
            }
          }
        }
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data, impactData, mode, selectedAuthor, selectedRange, smoothingWindow]);

  const chartTitle = mode === 'velocity' ? 'PR Velocity Over Time' : 'Code Impact Over Time';

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h2>{chartTitle}</h2>
        <div className="chart-header-controls">
          <label className="smoothing-label">
            Smoothing:
            <select
              className="smoothing-select"
              value={smoothingWindow}
              onChange={(e) => onSmoothingChange(Number(e.target.value))}
            >
              {SMOOTHING_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="chart-wrapper">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
};
