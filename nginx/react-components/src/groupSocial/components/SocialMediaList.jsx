/**
 * Reusable Social Media List Component
 * Displays and manages a list of social media links
 */

import React from 'react';
import Button from './Button.jsx';
import { PLATFORM_ICONS } from '../utils/config.js';
import { URLHelper } from '../utils/URLHelper.js';

const SocialMediaList = ({ 
    socials, 
    onEdit, 
    onDelete, 
    isLoading = false,
    showActions = true,
    emptyMessage = 'No social links yet',
    emptyDescription = 'Add social media links to get started.'
}) => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                <span className="mt-3 text-sm text-text-secondary">Loading social links...</span>
            </div>
        );
    }

    if (!socials || socials.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-4">🔗</div>
                <h3 className="text-lg font-medium text-text-primary mb-2">{emptyMessage}</h3>
                <p className="text-sm text-text-secondary">{emptyDescription}</p>
            </div>
        );
    }

    const handleLinkClick = (url, platform) => {
        // For email and phone, use appropriate protocols
        if (platform === 'Email' && !url.startsWith('mailto:')) {
            window.location.href = `mailto:${url}`;
        } else if (platform === 'Phone' && !url.startsWith('tel:')) {
            window.location.href = `tel:${url}`;
        } else {
            URLHelper.openInNewTab(url);
        }
    };

    const formatDisplayText = (url, platform) => {
        if (platform === 'Email' || platform === 'Phone') {
            return url;
        }
        return URLHelper.extractDomain(url);
    };

    const getActionText = (platform) => {
        switch (platform) {
            case 'Email':
                return 'Send email';
            case 'Phone':
                return 'Call number';
            default:
                return 'Visit profile';
        }
    };

    return (
        <div className="space-y-3">
            {socials.map((social) => (
                <div 
                    key={social.id} 
                    className="flex items-center justify-between bg-gray-50 border border-border-light rounded-card p-4 hover:bg-gray-100 transition-colors duration-200" 
                    data-platform={social.platform}
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-surface border border-border-light flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                            {PLATFORM_ICONS[social.platform] || '🔗'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-medium text-text-primary">{social.platform}</div>
                            <div 
                                className="text-sm text-text-secondary cursor-pointer hover:text-primary-500 transition-colors truncate" 
                                onClick={() => handleLinkClick(social.url, social.platform)}
                                title={formatDisplayText(social.url, social.platform)}
                            >
                                {formatDisplayText(social.url, social.platform)}
                            </div>
                        </div>
                    </div>

                    {showActions && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button 
                                size="sm"
                                variant="secondary"
                                onClick={() => handleLinkClick(social.url, social.platform)} 
                                title={getActionText(social.platform)}
                            >
                                🌐
                            </Button>
                            {onEdit && (
                                <Button 
                                    size="sm"
                                    variant="warning"
                                    onClick={() => onEdit(social)} 
                                    title="Edit"
                                >
                                    ✏️
                                </Button>
                            )}
                            {onDelete && (
                                <Button 
                                    size="sm"
                                    variant="danger"
                                    onClick={() => onDelete(social)} 
                                    title="Delete"
                                >
                                    🗑️
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default SocialMediaList;
