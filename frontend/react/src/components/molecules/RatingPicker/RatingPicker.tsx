import React from 'react';

export interface RatingOption {
  value: string;
  label: string;
  color: string;
}

export const EXPERIENCE_RATINGS: RatingOption[] = [
  { value: '***', label: 'Great', color: '#46D39A' },
  { value: '**', label: 'Okay', color: '#F5B544' },
  { value: '*', label: 'Bad', color: '#F4676E' },
];

interface RatingPickerProps {
  options: RatingOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Colored 3-way rating chips (Great/Okay/Bad) — first built inline for
// QuickLogModal, now shared with AddFriendForm's "How was the last chat?"
// field (Stage 6). Distinct from SegmentedControl: each option needs its own
// color rather than one shared active-state color.
const RatingPicker: React.FC<RatingPickerProps> = ({ options, value, onChange, className }) => (
  <div className={`flex gap-2 ${className ?? ''}`}>
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="flex-1 py-2.5 rounded-input font-bold text-sm border transition-colors"
          style={active
            ? { borderColor: opt.color, background: `${opt.color}22`, color: opt.color }
            : { borderColor: 'rgba(255,255,255,.1)', background: 'transparent', color: '#9A93A8' }}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

export default RatingPicker;
