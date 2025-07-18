/**
 * Media Element Factory Module
 * Creates DOM elements for different media types
 */

const MediaElementFactory = {
    /**
     * Create photo element
     * @param {Object} photo - Photo data object
     * @param {string} friendId - Friend ID
     * @returns {HTMLElement} Photo element
     */
    createPhoto(photo, friendId) {
        const div = document.createElement('div');
        div.className = 'media-item';
        
        const img = document.createElement('img');
        img.src = `/api/fileRepository/file/${friendId}/${photo.photoName}`;
        img.alt = photo.photoName;
        img.setAttribute('data-photo-name', photo.photoName);
        img.setAttribute('data-media-name', photo.photoName);
        img.setAttribute('data-friend-id', friendId);
        img.setAttribute('data-photo-id', photo.id);
        img.setAttribute('data-media-id', photo.id);
        img.setAttribute('data-media-type', 'photo');
        img.onclick = function() { MediaModal.openFromElement(this); };
        
        div.appendChild(img);
        return div;
    },

    /**
     * Create video element
     * @param {Object} video - Video data object
     * @param {string} friendId - Friend ID
     * @returns {HTMLElement} Video element
     */
    createVideo(video, friendId) {
        const div = document.createElement('div');
        div.className = 'media-item video';
        
        const videoThumbnail = document.createElement('div');
        videoThumbnail.className = 'video-thumbnail';
        videoThumbnail.setAttribute('data-video-name', video.videoName);
        videoThumbnail.setAttribute('data-friend-id', friendId);
        videoThumbnail.setAttribute('data-video-id', video.id);
        videoThumbnail.setAttribute('data-media-id', video.id);
        videoThumbnail.setAttribute('data-media-type', 'video');
        videoThumbnail.onclick = function() { MediaModal.openFromElement(this); };
        
        const videoIndicator = document.createElement('div');
        videoIndicator.className = 'video-indicator';
        videoIndicator.textContent = '▶';
        
        videoThumbnail.appendChild(videoIndicator);
        div.appendChild(videoThumbnail);
        return div;
    },

    /**
     * Create resource element
     * @param {Object} resource - Resource data object
     * @param {string} friendId - Friend ID
     * @returns {HTMLElement} Resource element
     */
    createResource(resource, friendId) {
        const div = document.createElement('div');
        div.className = 'media-item resource';
        
        const resourceItem = document.createElement('div');
        resourceItem.className = 'resource-item';
        resourceItem.setAttribute('data-resource-name', resource.resourceName);
        resourceItem.setAttribute('data-friend-id', friendId);
        resourceItem.setAttribute('data-mime-type', resource.mimeType);
        resourceItem.setAttribute('data-media-id', resource.id);
        resourceItem.setAttribute('data-media-type', 'resource');
        resourceItem.onclick = function() { MediaModal.openFromElement(this); };
        
        // Create resource icon
        const resourceIcon = document.createElement('div');
        resourceIcon.className = 'resource-icon';
        
        const iconSpan = document.createElement('span');
        iconSpan.textContent = this.getResourceIcon(resource.mimeType);
        resourceIcon.appendChild(iconSpan);
        
        // Create resource name
        const resourceName = document.createElement('div');
        resourceName.className = 'resource-name';
        resourceName.textContent = resource.resourceName;
        
        // Create resource type
        const resourceType = document.createElement('div');
        resourceType.className = 'resource-type';
        resourceType.textContent = resource.mimeType;
        
        resourceItem.appendChild(resourceIcon);
        resourceItem.appendChild(resourceName);
        resourceItem.appendChild(resourceType);
        div.appendChild(resourceItem);
        return div;
    },

    /**
     * Get appropriate icon for resource MIME type
     * @param {string} mimeType - The MIME type
     * @returns {string} Icon emoji
     */
    getResourceIcon(mimeType) {
        if (!mimeType) return '📁';
        
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
        if (mimeType.includes('text')) return '📋';
        if (mimeType.includes('audio')) return '🎵';
        if (mimeType.includes('video')) return '🎥';
        if (mimeType.includes('archive') || mimeType.includes('zip')) return '📦';
        
        return '📁';
    }
};
