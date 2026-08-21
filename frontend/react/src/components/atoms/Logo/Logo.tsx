import React from 'react';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

// The "L2" mark from the redesign handoff (Icons and Logo Sketches.dc.html):
// a rounded-square accent tile with a white speech bubble overlapping a
// lavender circle. Tile fill reads the --accent CSS var so it retints with
// the rest of the app's accent theming (see tailwind.config.js).
const Logo: React.FC<LogoProps> = ({ size = 30, showWordmark = true, className }) => {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="9" style={{ fill: 'rgb(var(--accent))' }} />
        <path
          d="M6 12a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2.5a3 3 0 0 1-3 3h-3.5L8 20v-2.2A3 3 0 0 1 6 15z"
          fill="#fff"
        />
        <circle cx="21" cy="18.5" r="5" style={{ fill: 'rgb(var(--accent))' }} />
        <circle cx="21" cy="18.5" r="4" fill="#C4B5FD" />
      </svg>
      {showWordmark && (
        <div className="font-display font-semibold text-base tracking-tight text-text-emphasis">
          Friends <span className="text-accent-light font-medium">Tracker</span>
        </div>
      )}
    </div>
  );
};

export default Logo;
