interface IconProps {
  name: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

/**
 * Icon Atom - Platform icons and general icons
 * Based on your existing platform icons with emojis
 */
export function Icon({ name, size = 'medium', className = '' }: IconProps) {
  // Platform icon mappings from your config
  const platformIcons: Record<string, string> = {
    'Instagram': '📸',
    'Facebook': '👤',
    'Twitter': '🐦',
    'LinkedIn': '💼',
    'GitHub': '💻',
    'YouTube': '🎥',
    'TikTok': '🎵',
    'Snapchat': '👻',
    'WhatsApp': '💬',
    'Telegram': '✈️',
    'Phone': '📞',
    'Email': '📧',
    'Website': '🌐',
    'Other': '🔗',
    // Additional utility icons
    'back': '←',
    'close': '×',
    'edit': '✏️',
    'delete': '🗑️',
    'loading': '⏳'
  };

  const sizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  };

  const classes = `${sizeClasses[size]} ${className}`.trim();

  const iconContent = platformIcons[name] || name;

  return (
    <span className={classes} role="img" aria-label={name}>
      {iconContent}
    </span>
  );
}
