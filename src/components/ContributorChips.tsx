import React from 'react';
import { COLORS, TEAM_COLOR } from '../utils/constants';
import { getFirstName } from '../utils/dataProcessing';

interface ContributorChipsProps {
  authorList: string[];
  selectedAuthor: string | null;
  onAuthorSelect: (author: string | null) => void;
}

export const ContributorChips: React.FC<ContributorChipsProps> = ({
  authorList,
  selectedAuthor,
  onAuthorSelect
}) => {
  return (
    <div className="control-group flex-grow">
      <label>Contributor</label>
      <div className="contributor-chips">
        <span
          className={`chip ${!selectedAuthor ? 'selected' : ''}`}
          style={{ background: TEAM_COLOR }}
          onClick={() => onAuthorSelect(null)}
        >
          Team
        </span>
        {authorList.map((author, idx) => {
          const color = COLORS[idx % COLORS.length];
          return (
            <span
              key={author}
              className={`chip ${selectedAuthor === author ? 'selected' : ''}`}
              style={{ background: color, '--chip-color': color } as React.CSSProperties}
              onClick={() => onAuthorSelect(author)}
            >
              {getFirstName(author)}
            </span>
          );
        })}
      </div>
    </div>
  );
};
