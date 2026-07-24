import React, { useEffect, useRef, useState } from 'react';

export interface DropdownMenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  triggerLabel?: string;
}

// Generic "⋮" trigger + menu, ported from the actions-cell dropdown pattern
// in nginx/static/mainPage/index.js — closes on outside click or item pick.
const DropdownMenu: React.FC<DropdownMenuProps> = ({ items, triggerLabel = '⋮' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((prev) => !prev); }}
        className="w-8 h-8 flex items-center justify-center rounded text-lg text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[160px] bg-white border border-gray-200 rounded shadow-lg z-50">
          {items.map((item, idx) => {
            const className = `block w-full text-left px-4 py-2 text-sm transition-colors ${
              item.danger
                ? 'text-red-600 hover:bg-red-50 border-t border-gray-100'
                : 'text-gray-700 hover:bg-gray-50'
            }`;
            const handleClick = () => {
              setOpen(false);
              item.onClick?.();
            };
            return item.href ? (
              <a key={idx} href={item.href} className={className} onClick={handleClick}>
                {item.label}
              </a>
            ) : (
              <button key={idx} type="button" className={className} onClick={handleClick}>
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DropdownMenu;
