import React, { useEffect } from 'react';

interface FlashMessageProps {
  message: string;
  variant: 'success' | 'error';
  onDismiss: () => void;
  autoDismissMs?: number;
}

// Ported from the #success-message/#error-message alerts in
// nginx/static/createGroup/createGroup.html (auto-hide after 5s there too).
const FlashMessage: React.FC<FlashMessageProps> = ({ message, variant, onDismiss, autoDismissMs = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoDismissMs]);

  const variantClasses = variant === 'success'
    ? 'bg-green-50 border-green-200 text-green-800'
    : 'bg-red-50 border-red-200 text-red-800';

  return (
    <div className={`p-4 rounded-lg border font-medium ${variantClasses}`}>
      {message}
    </div>
  );
};

export default FlashMessage;
