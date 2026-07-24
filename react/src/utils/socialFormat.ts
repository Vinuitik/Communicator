// Ported from nginx/static/social/modules/{config,formValidator,urlHelper}.js.

export const PLATFORM_ICONS: Record<string, string> = {
  Instagram: '📸',
  Facebook: '👤',
  Twitter: '🐦',
  LinkedIn: '💼',
  GitHub: '💻',
  YouTube: '🎥',
  TikTok: '🎵',
  Snapchat: '👻',
  WhatsApp: '💬',
  Telegram: '✈️',
  Phone: '📞',
  Email: '📧',
  Website: '🌐',
  Other: '🔗',
};

export const PLATFORM_OPTIONS = Object.keys(PLATFORM_ICONS);

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_PATTERN = /^[+]?[0-9\s\-()]{7,}$/;

export const urlHelpText = (platform: string): { help: string; placeholder: string } => {
  switch (platform) {
    case 'Email':
      return { help: 'Enter email address (e.g., friend@example.com)', placeholder: 'friend@example.com' };
    case 'Phone':
      return { help: 'Enter phone number (e.g., +1 234 567 8900)', placeholder: '+1 234 567 8900' };
    case 'Instagram':
      return { help: 'Enter Instagram URL or username', placeholder: 'https://instagram.com/username or @username' };
    case 'Twitter':
      return { help: 'Enter Twitter URL or handle', placeholder: 'https://twitter.com/handle or @handle' };
    default:
      return { help: 'Enter the full URL, phone number, or email address', placeholder: 'Enter URL, phone number, or email' };
  }
};

export const validateSocialUrl = (url: string, platform: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) return 'URL/Contact is required';
  switch (platform) {
    case 'Email':
      return EMAIL_PATTERN.test(trimmed) ? null : 'Please enter a valid email address';
    case 'Phone':
      return PHONE_PATTERN.test(trimmed) ? null : 'Please enter a valid phone number';
    default:
      return null;
  }
};

// Deliberately NOT reformatting the value before saving (e.g. auto-prefixing
// mailto:/https://) — see friendService.ts's social functions comment for
// why: the legacy page's formatURL() was silently dead code in production
// (the backend only ever read the raw, unformatted value), and the
// backend's own SocialService.isValidUrl already accepts bare emails, bare
// phone numbers, and @username-style handles directly. Applying the
// intended-but-never-run formatting now would risk breaking those
// already-working un-prefixed forms (an https:// prefix in front of
// "@username" would fail every one of the backend's own patterns) — safer
// to match years of actual production behavior than the code's original,
// untested intent.
