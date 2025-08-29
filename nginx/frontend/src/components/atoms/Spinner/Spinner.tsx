interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * Spinner Atom - Loading indicator
 * Based on your existing CSS class: loading-spinner
 */
export function Spinner({ size = 'medium', className = '' }: SpinnerProps) {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-6 w-6',
    large: 'h-8 w-8'
  };

  const classes = `
    animate-spin rounded-full border-2 border-gray-300 border-t-primary-600
    ${sizeClasses[size]}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className={classes} role="status" aria-label="Loading">
      <span className="sr-only">Loading...</span>
    </div>
  );
}
