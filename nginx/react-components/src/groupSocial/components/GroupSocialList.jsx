/**
 * Group Social Links List Component for displaying and managing social links
 */

import React from 'react';
import { PLATFORM_ICONS } from '../utils/config.js';
import { URLHelper } from '../utils/URLHelper.js';

const GroupSocialList = ({ socials, onEdit, onDelete, isLoading = false }) => {
    if (isLoading) {
        return (
            <div className="loading-state">
                <div className="loading-spinner"></div>
                <span>Loading group social links...</span>
            </div>
        );
    }

    if (!socials || socials.length === 0) {
        return (
            <div className="social-empty-state">
                <div style={{fontSize: '2rem', marginBottom: '1rem'}}>🔗</div>
                <h3>No social links yet</h3>
                <p>Add social media links for this group to get started.</p>
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
        <div className="social-list">
            {socials.map((social) => (
                <div key={social.id} className={`social-item ${social.platform.toLowerCase()}`} data-platform={social.platform}>
                    <div className="social-item-content">
                        <div className="social-icon">
                            {PLATFORM_ICONS[social.platform] || '🔗'}
                        </div>
                        <div className="social-info">
                            <div className="social-platform">{social.platform}</div>
                            <div 
                                className="social-url" 
                                onClick={() => handleLinkClick(social.url, social.platform)}
                            >
                                {formatDisplayText(social.url, social.platform)}
                            </div>
                        </div>
                    </div>

                    <div className="social-actions">
                        <button 
                            onClick={() => handleLinkClick(social.url, social.platform)} 
                            className="action-btn visit-btn"
                            title={getActionText(social.platform)}
                        >
                            🌐
                        </button>
                        <button 
                            onClick={() => onEdit(social)} 
                            className="action-btn edit-btn"
                            title="Edit"
                        >
                            ✏️
                        </button>
                        <button 
                            onClick={() => onDelete(social)} 
                            className="action-btn delete-btn"
                            title="Delete"
                        >
                            🗑️
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GroupSocialList;
