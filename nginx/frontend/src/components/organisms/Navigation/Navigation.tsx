import { NavLink } from '@/components/atoms/NavLink';

export interface NavigationItem {
  href: string;
  label: string;
  id?: string;
  active?: boolean;
}

interface NavigationProps {
  logo?: string;
  items: NavigationItem[];
  activeRoute?: string;
  className?: string;
  onLinkClick?: (href: string, id?: string) => void;
}

/**
 * Navigation Organism - Main application navigation bar
 * Based on your existing navbar design with purple background
 * Responsive design that stacks on mobile
 */
export function Navigation({
  logo = 'Friends Tracker',
  items,
  activeRoute,
  className = '',
  onLinkClick,
  ...props
}: NavigationProps) {
  const handleLinkClick = (href: string, id?: string) => {
    if (onLinkClick) {
      onLinkClick(href, id);
    }
  };

  return (
    <nav
      className={`
        bg-purple-500 px-8 py-4 
        flex justify-between items-center 
        shadow-md w-full max-w-full
        md:flex-row flex-col md:text-left text-center
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {/* Logo */}
      <div className="text-white text-xl font-medium navbar-logo">
        {logo}
      </div>

      {/* Navigation Links */}
      <ul className="
        flex list-none gap-4 mr-4
        md:flex-row md:mt-0 flex-col mt-4
        md:gap-4 gap-2
      ">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink
              href={item.href}
              id={item.id}
              active={item.active || activeRoute === item.href}
              onClick={() => handleLinkClick(item.href, item.id)}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Default navigation items based on your existing navbar
export const DEFAULT_NAV_ITEMS: NavigationItem[] = [
  { href: '/calendarView/calendar.html', label: 'Home' },
  { href: '/addFriendForm/addForm.html', label: 'Add Friend' },
  { href: '/', label: 'All Friends', id: 'navAllFriends' },
  { href: '/', label: 'This Week', id: 'navWeek' },
  { href: '/stats', label: 'Stats' }
];
