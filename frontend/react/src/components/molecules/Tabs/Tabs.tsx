import React from 'react';

export interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

// Underline-style tab row — used by the Profile hub (Overview/Media/Socials/
// Trends) and anywhere else that needs the same in-page section switcher.
const Tabs: React.FC<TabsProps> = ({ items, active, onChange, className }) => {
  return (
    <div className={`flex gap-0.5 ${className ?? ''}`}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${
              isActive
                ? 'font-bold text-text-emphasis border-accent'
                : 'font-semibold text-text-muted border-transparent hover:text-text-secondary'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
