/**
 * Group Social Links List Component for displaying and managing social links
 */

import React from 'react';
import { PLATFORM_ICONS } from '../utils/config.js';
import { URLHelper } from '../utils/URLHelper.js';

const GroupSocialList = ({ socials, onEdit, onDelete, isLoading = false }) => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="mt-2 text-sm text-gray-600">Loading group social links...</span>
            </div>
        );
    }

    if (!socials || socials.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="text-4xl mb-3">🔗</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No social links yet</h3>
                <p className="text-sm text-gray-500">Add social media links for this group to get started.</p>
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
        <div>
            <div className="space-y-3">
                {socials.map((social) => (
                    <div key={social.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors" data-platform={social.platform}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-lg shadow-sm">{PLATFORM_ICONS[social.platform] || '🔗'}</div>
                            <div>
                                <div className="font-medium text-gray-900">{social.platform}</div>
                                <div className="text-sm text-gray-500 cursor-pointer hover:text-blue-600" onClick={() => handleLinkClick(social.url, social.platform)}>{formatDisplayText(social.url, social.platform)}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleLinkClick(social.url, social.platform)} 
                                className="px-3 py-1.5 rounded-md bg-blue-500 text-white text-xs hover:bg-blue-600 transition-colors"
                                title={getActionText(social.platform)}
                            >
                                🌐
                            </button>
                            <button 
                                onClick={() => onEdit(social)} 
                                className="px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs hover:bg-amber-600 transition-colors"
                                title="Edit"
                            >
                                ✏️
                            </button>
                            <button 
                                onClick={() => onDelete(social)} 
                                className="px-3 py-1.5 rounded-md bg-red-500 text-white text-xs hover:bg-red-600 transition-colors"
                                title="Delete"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupSocialList;
