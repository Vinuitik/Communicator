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

// Ported from profile's modules/socialLinks.js's formatUrlForPlatform() — used
// only to build the clickable href for the profile page's read-only social
// links list. Unlike socialMediaManager.js's save-time formatURL() (dead code
// — see friendService.ts), this one runs purely client-side at display time on
// values already saved raw, so it's real, executing behavior worth preserving
// exactly, not a bug to route around.
export const formatSocialUrlForDisplay = (url: string, platform: string): string => {
  if (!url) return '#';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

  const lower = platform.toLowerCase();
  if (lower === 'email') return trimmed.startsWith('mailto:') ? trimmed : `mailto:${trimmed}`;
  if (lower === 'phone') return '#';

  const handle = trimmed.replace('@', '');
  switch (lower) {
    case 'instagram': return `https://www.instagram.com/${handle}`;
    case 'facebook': return `https://www.facebook.com/${handle}`;
    case 'twitter': return `https://twitter.com/${handle}`;
    case 'linkedin': return `https://www.linkedin.com/in/${handle}`;
    case 'github': return `https://github.com/${handle}`;
    case 'youtube': return `https://www.youtube.com/${handle}`;
    case 'tiktok': return `https://www.tiktok.com/@${handle}`;
    case 'snapchat': return `https://snapchat.com/add/${handle}`;
    case 'whatsapp': {
      const phone = trimmed.replace(/[^\d+]/g, '');
      return phone.startsWith('+') || phone.length > 7 ? `https://wa.me/${phone.replace('+', '')}` : `https://wa.me/${handle}`;
    }
    case 'telegram': return `https://t.me/${handle}`;
    default: return `https://${trimmed}`;
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
