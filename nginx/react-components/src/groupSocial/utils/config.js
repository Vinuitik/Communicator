/**
 * Configuration and Constants for Group Social Media Management
 */

export const CONFIG = {
    API_BASE_URL: '/api/groups',  // Changed from /api/friend/socials
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
    'TikTok': '🎵',
    'YouTube': '📺',
    'Discord': '🎮',
    'Telegram': '✈️',
    'WhatsApp': '💬',
    'Snapchat': '👻',
    'Pinterest': '📌',
    'Website': '🌐',
    'Email': '📧',
    'Phone': '📞'
};

export const PLATFORM_OPTIONS = [
    'Instagram',
    'Facebook', 
    'Twitter',
    'LinkedIn',
    'GitHub',
    'TikTok',
    'YouTube',
    'Discord',
    'Telegram',
    'WhatsApp',
    'Snapchat',
    'Pinterest',
    'Website',
    'Email',
    'Phone'
];
