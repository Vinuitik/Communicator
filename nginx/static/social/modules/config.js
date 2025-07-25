/**
 * Configuration and Constants for Social Media Management
 */

export const CONFIG = {
    API_BASE_URL: '/api/friend/socials',
    MESSAGE_DURATION: 3000,
    VALIDATION_PATTERNS: {
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        phone: /^[\+]?[0-9\s\-\(\)]{7,}$/,
        url: /^https?:\/\/.+/
    }
};

export const PLATFORM_ICONS = {
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
    'Other': '🔗'
};
