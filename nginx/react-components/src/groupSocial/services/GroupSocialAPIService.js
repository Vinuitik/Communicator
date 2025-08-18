/**
 * API Service for Group Social Media Management
 */

import { CONFIG } from '../utils/config.js';

export class GroupSocialAPIService {
    /**
     * Get all social media links for a group
     * @param {string} groupId Group ID
     * @returns {Promise<Array>} Array of social media links
     */
    static async getSocialsForGroup(groupId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/${groupId}/socials`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const socials = await response.json();
            return socials;
        } catch (error) {
            console.error('Error fetching group socials:', error);
            throw new Error('Failed to load group social media links');
        }
    }

    /**
     * Create a new social media link for a group
     * @param {string} groupId Group ID
     * @param {Object} socialData Social media data
     * @returns {Promise<Object>} Created social media link
     */
    static async createSocial(groupId, socialData) {
        try {
            console.log('Creating group social with data:', socialData);
            console.log('Request URL:', `${CONFIG.API_BASE_URL}/${groupId}/socials`);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/${groupId}/socials`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(socialData),
            });

            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log('Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error creating group social:', error);
            throw new Error('Failed to create group social media link');
        }
    }

    /**
     * Update an existing social media link
     * @param {string} groupId Group ID
     * @param {string} socialId Social media link ID
     * @param {Object} socialData Updated social media data
     * @returns {Promise<Object>} Updated social media link
     */
    static async updateSocial(groupId, socialId, socialData) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/${groupId}/socials/update/${socialId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(socialData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error updating group social:', error);
            throw new Error('Failed to update group social media link');
        }
    }

    /**
     * Delete a social media link
     * @param {string} groupId Group ID
     * @param {string} socialId Social media link ID
     * @returns {Promise<void>}
     */
    static async deleteSocial(groupId, socialId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/${groupId}/socials/delete/${socialId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error deleting group social:', error);
            throw new Error('Failed to delete group social media link');
        }
    }
}
