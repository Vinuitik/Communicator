/**
 * API Service for Social Media Management
 */

import { CONFIG } from './config.js';

export class SocialAPIService {
    /**
     * Get all social media links for a friend
     * @param {string} friendId Friend ID
     * @returns {Promise<Array>} Array of social media links
     */
    static async getSocialsForFriend(friendId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/${friendId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const socials = await response.json();
            return socials;
        } catch (error) {
            console.error('Error fetching socials:', error);
            throw new Error('Failed to load social media links');
        }
    }

    /**
     * Create a new social media link
     * @param {string} friendId Friend ID
     * @param {Object} socialData Social media data
     * @returns {Promise<Object>} Created social media link
     */
    static async createSocial(friendId, socialData) {
        try {
            console.log('Creating social with data:', socialData);
            console.log('Request URL:', `${CONFIG.API_BASE_URL}/${friendId}`);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/${friendId}`, {
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
            console.error('Error creating social:', error);
            throw new Error('Failed to create social media link');
        }
    }

    /**
     * Update an existing social media link
     * @param {string} socialId Social media link ID
     * @param {Object} socialData Updated social media data
     * @returns {Promise<Object>} Updated social media link
     */
    static async updateSocial(socialId, socialData) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/update/${socialId}`, {
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
            console.error('Error updating social:', error);
            throw new Error('Failed to update social media link');
        }
    }

    /**
     * Delete a social media link
     * @param {string} socialId Social media link ID
     * @returns {Promise<void>}
     */
    static async deleteSocial(socialId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/delete/${socialId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error deleting social:', error);
            throw new Error('Failed to delete social media link');
        }
    }
}
