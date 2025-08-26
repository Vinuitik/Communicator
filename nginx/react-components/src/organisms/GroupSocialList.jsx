/**
 * GroupSocialList Organism Component
 * Complete list of social media items with loading and empty states
 */

import React from 'react';
import { SocialMediaItem } from '../molecules';

const GroupSocialList = ({ socials, onEdit, onDelete, isLoading = false }) => {
    if (isLoading) {
        return (
            <div className="loading-state flex flex-col items-center justify-center py-12">
                <div className="loading-spinner animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <span className="text-gray-600">Loading group social links...</span>
            </div>
        );
    }

    if (!socials || socials.length === 0) {
        return (
            <div className="social-empty-state text-center py-12">
                <div className="text-6xl mb-4">🔗</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No social links yet</h3>
                <p className="text-gray-600">Add social media links for this group to get started.</p>
            </div>
        );
    }

    return (
        <div className="social-list space-y-4">
            {socials.map((social) => (
                <SocialMediaItem
                    key={social.id}
                    social={social}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

export default GroupSocialList;
