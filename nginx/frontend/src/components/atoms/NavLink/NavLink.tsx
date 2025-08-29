import React from 'react';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  id?: string;
}

/**
 * NavLink Atom - Navigation link with hover effects
 * Based on your existing navbar-links a styling
 */
export function NavLink({
  href,
  children,
  active = false,
  onClick,
  className = '',
  id,
  ...props
}: NavLinkProps) {
  const baseClasses = 'text-white no-underline px-3 py-2 rounded transition-colors whitespace-nowrap block';
  const hoverClasses = 'hover:bg-white hover:bg-opacity-10';
  const activeClasses = active ? 'bg-white bg-opacity-20' : '';
  
  const classes = `
    ${baseClasses}
    ${hoverClasses}
    ${activeClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <a
      href={href}
      id={id}
      className={classes}
      onClick={onClick}
      {...props}
    >
      {children}
    </a>
  );
}
