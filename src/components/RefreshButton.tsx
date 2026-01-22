import React from 'react';

interface RefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  disabled?: boolean;
  currentRepo?: string | null;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  isRefreshing,
  disabled = false,
  currentRepo
}) => {
  return (
    <button
      className="refresh-button"
      onClick={onRefresh}
      disabled={isRefreshing || disabled}
      title={disabled ? 'Azure DevOps PAT not configured' : 'Fetch latest PR data from Azure DevOps'}
    >
      {isRefreshing ? (
        <>
          <span className="spinner"></span>
          {currentRepo 
            ? `Refreshing ${currentRepo ?? ''}`
            : 'Refreshing...'
          }

        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </>
      )}
    </button>
  );
};
