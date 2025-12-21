import React, { useState, useRef, useEffect } from 'react';
import { DashboardMode } from '../types';

interface ModeSelectorProps {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
}

const MODE_OPTIONS: { value: DashboardMode; label: string; description: string }[] = [
  { value: 'velocity', label: 'PR Velocity', description: 'PRs per contributor or team' },
  { value: 'impact', label: 'Impact', description: 'Lines of code changed per PR' }
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onModeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = MODE_OPTIONS.find(opt => opt.value === mode);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (value: DashboardMode) => {
    onModeChange(value);
    setIsOpen(false);
  };

  return (
    <div className="mode-selector" ref={dropdownRef}>
      <button
        className="mode-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="mode-selector-label">{currentOption?.label} Dashboard</span>
        <svg
          className={`mode-selector-arrow ${isOpen ? 'open' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div className="mode-selector-dropdown">
          {MODE_OPTIONS.map(option => (
            <button
              key={option.value}
              className={`mode-selector-option ${mode === option.value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              <span className="option-label">{option.label}</span>
              <span className="option-description">{option.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
