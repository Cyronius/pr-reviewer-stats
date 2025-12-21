import React from 'react';
import { RangeKey } from '../types';
import { RANGES } from '../utils/constants';

interface TimeRangeSelectorProps {
  selectedRange: RangeKey;
  onRangeSelect: (range: RangeKey) => void;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onRangeSelect
}) => {
  return (
    <div className="control-group">
      <label>Time Range</label>
      <div className="btn-group">
        {(Object.entries(RANGES) as [RangeKey, typeof RANGES[RangeKey]][]).map(([key, val]) => (
          <button
            key={key}
            className={`btn ${selectedRange === key ? 'active' : ''}`}
            onClick={() => onRangeSelect(key)}
          >
            {val.label}
          </button>
        ))}
      </div>
    </div>
  );
};
