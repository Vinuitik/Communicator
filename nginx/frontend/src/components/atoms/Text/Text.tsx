import React from 'react';

interface TextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'help' | 'error';
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
}

/**
 * Text Atom - Typography component for consistent text styling
 * Based on your existing CSS classes: social-title, social-subtitle, form-help, form-error
 */
export function Text({
  children,
  variant = 'body',
  className = '',
  as,
  ...props
}: TextProps) {
  // Determine the HTML element based on variant or explicit 'as' prop
  const getElement = () => {
    if (as) return as;
    
    switch (variant) {
      case 'h1': return 'h1';
      case 'h2': return 'h2';
      case 'h3': return 'h3';
      case 'h4': return 'h4';
      default: return 'p';
    }
  };

  // Variant styles based on your existing design
  const variantClasses = {
    h1: 'text-2xl font-semibold text-gray-900',
    h2: 'text-xl font-medium text-gray-900',
    h3: 'text-lg font-medium text-gray-900',
    h4: 'text-base font-medium text-gray-900',
    body: 'text-base text-gray-700',
    caption: 'text-sm text-gray-600',
    help: 'text-xs text-gray-500 mt-1',
    error: 'text-xs text-red-600 mt-1'
  };

  const classes = `${variantClasses[variant]} ${className}`.trim();
  const Element = getElement();

  return (
    <Element className={classes} {...props}>
      {children}
    </Element>
  );
}
