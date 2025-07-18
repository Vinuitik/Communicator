/**
 * Gallery Manager Module
 * Handles media gallery state and updates
 */

const GalleryManager = {
    /**
     * Update gallery state after media changes (deletion, addition, etc.)
     */
    updateState() {
        const mediaGallery = document.querySelector('.media-gallery');
        if (!mediaGallery) return;
        
        // Count remaining media items
        const remainingPhotos = mediaGallery.querySelectorAll('[data-media-type="photo"]').length;
        const remainingVideos = mediaGallery.querySelectorAll('[data-media-type="video"]').length;
        const remainingResources = mediaGallery.querySelectorAll('[data-media-type="resource"]').length;
        
        const totalRemaining = remainingPhotos + remainingVideos + remainingResources;
        
        // If no media left, show placeholder
        if (totalRemaining === 0) {
            this.showEmptyPlaceholder();
        }
        
        // Update any counters or section headers if they exist
        this.updateMediaCounts(remainingPhotos, remainingVideos, remainingResources);
    },

    /**
     * Show empty gallery placeholder
     */
    showEmptyPlaceholder() {
        const mediaGallery = document.querySelector('.media-gallery');
        if (!mediaGallery) return;
        
        // Remove existing placeholder if any
        const existingPlaceholder = mediaGallery.querySelector('.no-media-placeholder');
        if (existingPlaceholder) {
            existingPlaceholder.remove();
        }
        
        // Create new placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'no-media-placeholder';
        placeholder.innerHTML = '<p>No photos, videos, or resources yet. Click "Add Media" to get started!</p>';
        
        mediaGallery.appendChild(placeholder);
    },

    /**
     * Update media counts display
     * @param {number} photoCount - Number of photos
     * @param {number} videoCount - Number of videos  
     * @param {number} resourceCount - Number of resources
     */
    updateMediaCounts(photoCount, videoCount, resourceCount) {
        // Update section title or any counters you might have
        const sectionTitle = document.querySelector('.media-gallery').closest('.profile-section')?.querySelector('.section-title');
        if (sectionTitle && !sectionTitle.textContent.includes('Media Gallery')) {
            // Only update if there are actual counters to update
            console.log(`Updated counts - Photos: ${photoCount}, Videos: ${videoCount}, Resources: ${resourceCount}`);
        }
    },

    /**
     * Clear all media items from gallery
     */
    clearAllItems() {
        const mediaGallery = document.querySelector('.media-gallery');
        if (!mediaGallery) return;
        
        // Remove all media items but keep placeholder logic
        const existingItems = mediaGallery.querySelectorAll('.media-item');
        existingItems.forEach(item => item.remove());
        
        // Remove existing placeholder if it exists
        const existingPlaceholder = mediaGallery.querySelector('.no-media-placeholder');
        if (existingPlaceholder) {
            existingPlaceholder.remove();
        }
    },

    /**
     * Add media items to gallery
     * @param {Array} photos - Array of photo objects
     * @param {Array} videos - Array of video objects
     * @param {Array} resources - Array of resource objects
     * @param {string} friendId - Friend ID for the media
     */
    addMediaItems(photos, videos, resources, friendId) {
        const mediaGallery = document.querySelector('.media-gallery');
        if (!mediaGallery) return;
        
        let hasMedia = false;
        
        // Add photos
        if (photos && photos.length > 0) {
            photos.forEach(photo => {
                const photoElement = MediaElementFactory.createPhoto(photo, friendId);
                mediaGallery.appendChild(photoElement);
                hasMedia = true;
            });
        }
        
        // Add videos
        if (videos && videos.length > 0) {
            videos.forEach(video => {
                const videoElement = MediaElementFactory.createVideo(video, friendId);
                mediaGallery.appendChild(videoElement);
                hasMedia = true;
            });
        }
        
        // Add resources
        if (resources && resources.length > 0) {
            resources.forEach(resource => {
                const resourceElement = MediaElementFactory.createResource(resource, friendId);
                mediaGallery.appendChild(resourceElement);
                hasMedia = true;
            });
        }
        
        // Show placeholder if no media
        if (!hasMedia) {
            this.showEmptyPlaceholder();
        }
    }
};
