import React from 'react';

export interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// The pill-in-a-track control used all over the redesign: Knowledge's
// Structured/Raw toggle, Trends/Insights range & metric pills, the
// quick-log rating buttons build on the same idea but need per-option
// colors, so they don't use this — this is for same-styled option sets.
const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, value, onChange, className }) => {
  return (
    <div className={`flex gap-0.5 bg-input border border-white/10 rounded-lg p-0.5 ${className ?? ''}`}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1.5 rounded-md text-xs transition-colors ${
              isActive ? 'bg-accent/25 text-text-emphasis font-bold' : 'text-text-muted font-semibold hover:text-text-secondary'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
