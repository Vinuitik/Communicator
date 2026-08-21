import React from 'react';

interface ProgressBarProps {
  /** 0-100 */
  percent: number;
  /** CSS color for the fill — callers compute this (RYG, confidence thresholds, etc). */
  color: string;
  className?: string;
  trackClassName?: string;
}

// Generic thin progress/meter bar — used for knowledge-fact confidence and
// intensity meters (Friends table, Profile hero, Knowledge tab). Color is
// caller-supplied because it's data-driven (RYG interpolation, confidence
// thresholds), not a fixed token.
const ProgressBar: React.FC<ProgressBarProps> = ({ percent, color, className, trackClassName }) => {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={`h-1.5 rounded-full bg-white/10 overflow-hidden ${trackClassName ?? ''} ${className ?? ''}`}>
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
};

export default ProgressBar;
