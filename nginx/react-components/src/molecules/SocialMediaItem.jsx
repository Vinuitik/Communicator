/**
 * SocialMediaItem Molecule Component
 * Individual social media link display with actions
 */

import React from 'react';
import { Card, Button } from '../atoms';
import { PLATFORM_ICONS } from '../groupSocial/utils/config.js';
import { URLHelper } from '../groupSocial/utils/URLHelper.js';

const SocialMediaItem = ({ 
    social,
    onEdit,
    onDelete,
    className = '' 
}) => {
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
                return 'Call';
            case 'WhatsApp':
                return 'Open WhatsApp';
            default:
                return 'Visit';
        }
    };

    const platformIcon = PLATFORM_ICONS[social.platform] || '🔗';
    const displayText = formatDisplayText(social.url, social.platform);
    const actionText = getActionText(social.platform);

    return (
        <Card 
            variant="default" 
            padding="md" 
            className={`social-item ${className}`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                    <div className="social-icon text-2xl">
                        {platformIcon}
                    </div>
                    <div className="social-info flex-1">
                        <div className="social-platform font-semibold text-gray-900">
                            {social.platform}
                        </div>
                        <div className="social-url text-sm text-gray-600 break-all">
                            {displayText}
                        </div>
                    </div>
                </div>
                
                <div className="social-actions flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLinkClick(social.url, social.platform)}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                    >
                        {actionText}
                    </Button>
                    
                    {onEdit && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(social)}
                            className="text-gray-600 hover:text-gray-800"
                            aria-label={`Edit ${social.platform} link`}
                        >
                            ✏️
                        </Button>
                    )}
                    
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(social.id)}
                            className="text-red-600 hover:text-red-800"
                            aria-label={`Delete ${social.platform} link`}
                        >
                            🗑️
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default SocialMediaItem;
