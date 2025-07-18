/**
 * Media Modal Module
 * Handles all media modal functionality including opening, closing, and previewing different media types
 */

const MediaModal = {
    // Current media state
    currentMediaName: '',
    currentMediaType: '',
    currentFriendId: '',
    currentMimeType: '',
    currentMediaId: '',

    /**
     * Initialize the media modal
     */
    init() {
        this.setupEventListeners();
    },

    /**
     * Set up all event listeners for the modal
     */
    setupEventListeners() {
        const modal = document.getElementById('mediaModal');
        const closeBtn = document.getElementById('closeMediaModal');
        const closeModalBtn = document.getElementById('closeMediaBtn');
        const deleteBtn = document.getElementById('deleteMediaBtn');

        // Close modal events
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.close());
        }

        // Close modal when clicking outside
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.close();
            }
        });

        // Delete button functionality
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => MediaDeletion.deleteCurrentMedia());
        }
    },

    /**
     * Open modal with media element data
     * @param {HTMLElement} element - The clicked media element
     */
    openFromElement(element) {
        const mediaType = element.getAttribute('data-media-type') || 
                         element.closest('[data-media-type]')?.getAttribute('data-media-type');
        
        if (!mediaType) {
            console.error('No media type found on clicked element');
            return;
        }

        const fileName = element.getAttribute(`data-${mediaType}-name`);
        const friendId = element.getAttribute('data-friend-id');
        const mediaId = element.getAttribute(`data-media-id`);
        const mimeType = element.getAttribute('data-mime-type') || '';

        this.currentMediaName = fileName;
        this.currentMediaType = mediaType;
        this.currentFriendId = friendId;
        this.currentMimeType = mimeType;
        this.currentMediaId = mediaId;

        this.updateModalContent();
        this.show();
    },

    /**
     * Update modal content with current media data
     */
    updateModalContent() {
        const modalTitle = document.getElementById('mediaModalTitle');
        const mediaName = document.getElementById('modalMediaName');
        const mediaTypeSpan = document.getElementById('modalMediaType');

        if (modalTitle) {
            modalTitle.textContent = this.currentMediaName;
        }
        
        if (mediaName) {
            mediaName.textContent = this.currentMediaName;
        }
        
        if (mediaTypeSpan) {
            mediaTypeSpan.textContent = this.currentMediaType === 'resource' ? 
                (this.currentMimeType || 'Unknown') : this.currentMediaType;
        }
        
        this.generatePreview();
        this.fetchMediaInfo();
    },

    /**
     * Generate preview content based on media type
     */
    generatePreview() {
        const previewContainer = document.getElementById('mediaPreviewContainer');
        const fileUrl = `/api/fileRepository/file/${this.currentFriendId}/${this.currentMediaName}`;
        let previewHTML = '';

        switch (this.currentMediaType) {
            case 'photo':
                previewHTML = `<img src="${fileUrl}" alt="${this.currentMediaName}" class="media-preview-image">`;
                break;
                
            case 'video':
                previewHTML = `
                    <video controls class="media-preview-video">
                        <source src="${fileUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                `;
                break;
                
            case 'resource':
                previewHTML = this.generateResourcePreview(fileUrl);
                break;
                
            default:
                previewHTML = this.generateDefaultPreview();
                break;
        }

        if (previewContainer) {
            previewContainer.innerHTML = previewHTML;
        }
        
        // Update primary photo button for photos
        PrimaryPhoto.updateButton(this.currentMediaType);
    },

    /**
     * Generate resource preview based on MIME type
     * @param {string} fileUrl - The file URL
     * @returns {string} HTML string for resource preview
     */
    generateResourcePreview(fileUrl) {
        if (this.currentMimeType && this.currentMimeType.includes('pdf')) {
            return `<iframe src="${fileUrl}" style="width: 100%; height: 500px; border: none; border-radius: 8px;"></iframe>`;
        } else if (this.currentMimeType && this.currentMimeType.includes('image')) {
            return `<img src="${fileUrl}" alt="${this.currentMediaName}" class="media-preview-image">`;
        } else {
            const icon = this.getResourceIcon(this.currentMimeType);
            return `
                <div class="media-preview-document">
                    <i style="font-size: 64px; margin-bottom: 16px;">${icon}</i>
                    <h4>${this.currentMediaName}</h4>
                    <p>Preview not available for this file type</p>
                    <a href="${fileUrl}" target="_blank" class="media-btn media-btn-secondary" style="margin-top: 15px; text-decoration: none;">
                        Open in New Tab
                    </a>
                </div>
            `;
        }
    },

    /**
     * Get appropriate icon for resource type
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
    },

    /**
     * Generate default preview for unknown media types
     * @returns {string} HTML string for default preview
     */
    generateDefaultPreview() {
        return `
            <div class="media-preview-document">
                <i style="font-size: 64px; color: #667; margin-bottom: 16px;">📁</i>
                <h4>${this.currentMediaName}</h4>
                <p>Preview not available for this file type</p>
            </div>
        `;
    },

    /**
     * Fetch and display media file information
     */
    async fetchMediaInfo() {
        try {
            const response = await fetch(`/api/fileRepository/info/${this.currentFriendId}/${this.currentMediaName}`);
            if (response.ok) {
                const info = await response.json();
                const mediaSize = document.getElementById('modalMediaSize');
                if (mediaSize && info.size) {
                    mediaSize.textContent = Utils.formatFileSize(info.size);
                }
            }
        } catch (error) {
            console.warn('Could not fetch media info:', error);
            const mediaSize = document.getElementById('modalMediaSize');
            if (mediaSize) {
                mediaSize.textContent = 'Unknown';
            }
        }
    },

    /**
     * Show the modal
     */
    show() {
        const modal = document.getElementById('mediaModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            modal.offsetHeight; // Force reflow
        }
    },

    /**
     * Close the modal
     */
    close() {
        const modal = document.getElementById('mediaModal');
        const previewContainer = document.getElementById('mediaPreviewContainer');
        
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        // Clean up object URLs to prevent memory leaks
        if (previewContainer) {
            const mediaElements = previewContainer.querySelectorAll('img, video, audio, iframe');
            mediaElements.forEach(el => {
                if (el.src && el.src.startsWith('blob:')) {
                    URL.revokeObjectURL(el.src);
                }
            });
        }
        
        this.resetState();
    },

    /**
     * Reset current media state
     */
    resetState() {
        this.currentMediaName = '';
        this.currentMediaType = '';
        this.currentFriendId = '';
        this.currentMimeType = '';
        this.currentMediaId = '';
    },

    /**
     * Check if modal is currently visible
     * @returns {boolean} True if modal is visible
     */
    isVisible() {
        const modal = document.getElementById('mediaModal');
        return modal && (modal.style.display === 'block' || 
               (modal.style.display === '' && window.getComputedStyle(modal).display === 'block'));
    },

    /**
     * Get current media data
     * @returns {Object} Current media data
     */
    getCurrentMedia() {
        return {
            name: this.currentMediaName,
            type: this.currentMediaType,
            friendId: this.currentFriendId,
            mimeType: this.currentMimeType,
            id: this.currentMediaId
        };
    }
};

// Global function for backward compatibility
function openMediaModalFromElement(element) {
    MediaModal.openFromElement(element);
}
