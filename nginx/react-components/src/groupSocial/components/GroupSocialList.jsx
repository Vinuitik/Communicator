/**
 * Group Social Links List Component for displaying and managing social links
 */

import React from 'react';
import { PLATFORM_ICONS } from '../utils/config.js';
import { URLHelper } from '../utils/URLHelper.js';

const GroupSocialList = ({ socials, onEdit, onDelete, isLoading = false }) => {
    if (isLoading) {
        return (
            <div className="social-list-loading">
                <div className="loading-spinner"></div>
                <span>Loading group social links...</span>
            </div>
        );
    }

    if (!socials || socials.length === 0) {
        return (
            <div className="social-list-empty">
                <div className="empty-state">
                    <span className="empty-icon">🔗</span>
                    <h3>No social links yet</h3>
                    <p>Add social media links for this group to get started.</p>
                </div>
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
                    <div key={social.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-md p-3" data-platform={social.platform}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg">{PLATFORM_ICONS[social.platform] || '🔗'}</div>
                            <div>
                                <div className="font-semibold">{social.platform}</div>
                                <div className="text-xs text-gray-500">{formatDisplayText(social.url, social.platform)}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button onClick={() => onEdit(social)} className="px-3 py-1 rounded-md bg-yellow-400 text-white text-sm">✏️</button>
                            <button onClick={() => onDelete(social)} className="px-3 py-1 rounded-md bg-red-500 text-white text-sm">🗑️</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupSocialList;
