import React from 'react';

interface LabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}

/**
 * Label Atom - Form label with optional required indicator
 * Based on your existing CSS class: form-label
 */
export function Label({
  children,
  htmlFor,
  required = false,
  className = '',
  ...props
}: LabelProps) {
  const baseClasses = 'block text-sm font-medium text-gray-700 mb-1';
  
  const classes = `${baseClasses} ${className}`.trim();

  return (
    <label htmlFor={htmlFor} className={classes} {...props}>
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}
