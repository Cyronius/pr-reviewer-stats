import React, { useEffect, useRef } from 'react';
import { PRRecord } from '../types';

interface ContributorModalProps {
  author: string;
  prs: PRRecord[];
  org: string;
  onClose: () => void;
}

export const ContributorModal: React.FC<ContributorModalProps> = ({
  author,
  prs,
  org,
  onClose
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const buildAzureDevOpsUrl = (pr: PRRecord) => {
    return `https://dev.azure.com/${org}/${encodeURIComponent(pr.project)}/_git/${encodeURIComponent(pr.repository)}/pullrequest/${pr.prId}`;
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal" ref={modalRef}>
        <div className="modal-header">
          <h2>PRs by {author}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-subtitle">
          Showing {prs.length} PR{prs.length !== 1 ? 's' : ''}
        </div>
        <div className="modal-body">
          {prs.map((pr) => (
            <div key={`${pr.repository}-${pr.prId}`} className="pr-item">
              <div className="pr-date">{formatDate(pr.closedDate)}</div>
              <div className="pr-title">{pr.title}</div>
              <div className="pr-meta">
                <span className="pr-repo">{pr.repository}</span>
                <a
                  href={buildAzureDevOpsUrl(pr)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pr-link"
                >
                  View in Azure DevOps
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
