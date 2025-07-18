/**
 * Media Deletion Module
 * Handles deletion of media items (photos, videos, resources)
 */

const MediaDeletion = {
    /**
     * Delete the currently selected media
     */
    async deleteCurrentMedia() {
        const currentMedia = MediaModal.getCurrentMedia();
        
        if (!currentMedia.name || !currentMedia.friendId || !currentMedia.id) {
            console.error('No media selected for deletion');
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete "${currentMedia.name}"?`);
        if (!confirmed) {
            return;
        }

        // Show loading state on delete button
        const deleteBtn = document.getElementById('deleteMediaBtn');
        if (!deleteBtn) return;
        
        const originalBtnText = deleteBtn.innerHTML;
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i>⏳</i> Deleting...';

        try {
            const success = await this.performDeletion(currentMedia);
            
            if (success) {
                // Close modal first
                MediaModal.close();
                
                // Remove the media item from DOM
                this.removeFromDOM(currentMedia.id, currentMedia.type);
                
                // Show success feedback
                NotificationManager.showSuccess(`"${currentMedia.name}" has been deleted successfully.`);
            }
        } catch (error) {
            console.error('Error deleting media:', error);
            alert('Failed to delete media. Please try again.');
        } finally {
            // Restore delete button
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = originalBtnText;
        }
    },

    /**
     * Perform the actual deletion API call
     * @param {Object} mediaData - Media data to delete
     * @returns {boolean} Success status
     */
    async performDeletion(mediaData) {
        const formData = new FormData();
        
        // Initialize empty arrays for all media types
        const photoIds = [];
        const videoIds = [];
        const resourceIds = [];
        
        // Add the current media ID to the appropriate array based on type
        switch (mediaData.type) {
            case 'photo':
                photoIds.push(mediaData.id);
                break;
            case 'video':
                videoIds.push(mediaData.id);
                break;
            case 'resource':
                resourceIds.push(mediaData.id);
                break;
            default:
                console.error('Unknown media type:', mediaData.type);
                return false;
        }
        
        // Add all arrays to form data
        formData.append('photos', photoIds);
        formData.append('videos', videoIds);
        formData.append('resources', resourceIds);
        formData.append('friendId', mediaData.friendId);

        const response = await fetch('/api/friend/files/delete', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Delete response:', result);
            return true;
        } else {
            const error = await response.text();
            alert('Failed to delete media: ' + error);
            return false;
        }
    },

    /**
     * Remove media item from DOM
     * @param {string} mediaId - ID of the media to remove
     * @param {string} mediaType - Type of media (photo, video, resource)
     */
    removeFromDOM(mediaId, mediaType) {
        // Find the media element by data-media-id
        const mediaElement = document.querySelector(`[data-media-id="${mediaId}"]`);
        
        if (mediaElement) {
            // Find the parent container (.media-item) that needs to be removed
            const mediaContainer = mediaElement.closest('.media-item');
            
            if (mediaContainer) {
                // Add fade out animation to the container
                mediaContainer.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                mediaContainer.style.opacity = '0';
                mediaContainer.style.transform = 'scale(0.8)';
                
                // Remove container after animation
                setTimeout(() => {
                    mediaContainer.remove();
                    
                    // Check if gallery is now empty and update accordingly
                    GalleryManager.updateState();
                    
                    // Update pagination if needed
                    this.updatePaginationAfterDelete();
                    
                }, 300);
            } else {
                // Fallback: remove the media element directly if no container found
                this.removeElementWithAnimation(mediaElement);
            }
        } else {
            console.warn('Media element not found in DOM, falling back to page reload');
            window.location.reload();
        }
    },

    /**
     * Remove element with fade animation
     * @param {HTMLElement} element - Element to remove
     */
    removeElementWithAnimation(element) {
        element.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        element.style.opacity = '0';
        element.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            element.remove();
            GalleryManager.updateState();
            this.updatePaginationAfterDelete();
        }, 300);
    },

    /**
     * Update pagination after deletion
     */
    updatePaginationAfterDelete() {
        // Check if pagination module is available and update
        if (typeof Pagination !== 'undefined' && typeof Pagination.updateAfterDeletion === 'function') {
            Pagination.updateAfterDeletion();
        }
    }
};
