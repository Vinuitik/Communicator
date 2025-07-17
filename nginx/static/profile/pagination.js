// Create pagination namespace
const Pagination = {
    currentPage: 1,
    totalPages: 5, // Will be updated from server
    totalItems: 48, // Will be updated from server
    paginationFriendId: null,
    
    init: function() {
        this.initializeMediaPagination();
        
        // Extract friend ID from the page
        const mediaItems = document.querySelectorAll('[data-friend-id]');
        if (mediaItems.length > 0) {
            this.paginationFriendId = mediaItems[0].getAttribute('data-friend-id');
            
            // Automatically load the first page to get correct pagination data
            this.loadInitialPage();
        }
    },
    
    // Load initial page to get correct pagination metadata
    async loadInitialPage() {
        try {
            const success = await this.loadMediaPage(1, this.paginationFriendId);
            if (success) {
                // Pagination will be automatically updated in loadMediaPage
                console.log(`Pagination initialized: ${this.totalItems} items across ${this.totalPages} pages`);
            }
        } catch (error) {
            console.error('Error loading initial page data:', error);
            // Keep the hardcoded defaults if server fails
        }
    },
    
    // Initialize pagination
    initializeMediaPagination: function() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const pageInput = document.getElementById('pageInput');
        const goBtn = document.getElementById('goToPageBtn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        }

        if (goBtn) {
            goBtn.addEventListener('click', this.goToCustomPage.bind(this));
        }

        if (pageInput) {
            pageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    this.goToCustomPage();
                }
            }.bind(this));
        }

        // Initial render
        this.renderPagination();
    },

    // Render pagination numbers
    renderPagination: function() {
        const paginationNumbers = document.getElementById('paginationNumbers');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (!paginationNumbers) return;

        paginationNumbers.innerHTML = '';

        // Update navigation buttons
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === this.totalPages;
        }

        // Generate page numbers
        if (this.totalPages <= 5) {
            // Show all pages if 5 or fewer
            for (let i = 1; i <= this.totalPages; i++) {
                paginationNumbers.appendChild(this.createPageButton(i));
            }
        } else {
            // Complex pagination with input field
            if (this.currentPage <= 3) {
                // Show: 1 2 3 [input] ... 5
                for (let i = 1; i <= 3; i++) {
                    paginationNumbers.appendChild(this.createPageButton(i));
                }
                paginationNumbers.appendChild(this.createInputContainer());
                paginationNumbers.appendChild(this.createPageButton(this.totalPages));
            } else if (this.currentPage >= this.totalPages - 2) {
                // Show: 1 ... [input] 3 4 5
                paginationNumbers.appendChild(this.createPageButton(1));
                paginationNumbers.appendChild(this.createInputContainer());
                for (let i = this.totalPages - 2; i <= this.totalPages; i++) {
                    paginationNumbers.appendChild(this.createPageButton(i));
                }
            } else {
                // Show: 1 ... [input] ... 5
                paginationNumbers.appendChild(this.createPageButton(1));
                paginationNumbers.appendChild(this.createInputContainer());
                paginationNumbers.appendChild(this.createPageButton(this.totalPages));
            }
        }

        // Update page info
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages} • ${this.totalItems} items`;
        }
    },

    // Create page button
    createPageButton: function(pageNumber) {
        const button = document.createElement('button');
        button.className = 'pagination-number';
        button.textContent = pageNumber;
        button.setAttribute('data-page', pageNumber);
        
        if (pageNumber === this.currentPage) {
            button.classList.add('active');
        }
        
        button.addEventListener('click', () => this.goToPage(pageNumber));
        
        return button;
    },

    // Create input container
    createInputContainer: function() {
        const container = document.createElement('div');
        container.className = 'pagination-input-container';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'pagination-input';
        input.id = 'pageInput';
        input.min = '1';
        input.max = this.totalPages;
        input.placeholder = '...';
        
        const button = document.createElement('button');
        button.className = 'pagination-go-btn';
        button.textContent = 'Go';
        button.addEventListener('click', this.goToCustomPage.bind(this));
        
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.goToCustomPage();
            }
        }.bind(this));
        
        container.appendChild(input);
        container.appendChild(button);
        
        return container;
    },

    // Go to specific page
    async goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }
        
        // Show loading state
        this.showLoadingState();
        
        try {
            // Load data from backend
            const success = await this.loadMediaPage(page, this.paginationFriendId);
            
            if (success) {
                this.currentPage = page;
                this.renderPagination();
            }
        } catch (error) {
            console.error('Error loading page:', error);
            this.showErrorMessage('Failed to load page. Please try again.');
        } finally {
            this.hideLoadingState();
        }
    },

    // Go to custom page from input
    goToCustomPage: function() {
        const input = document.getElementById('pageInput');
        if (!input) return;
        
        const page = parseInt(input.value);
        if (isNaN(page) || page < 1 || page > this.totalPages) {
            input.value = '';
            return;
        }
        
        this.goToPage(page);
        input.value = '';
    },

    // Load media page from backend
    async loadMediaPage(pageId, friendId) {
        try {
            const response = await fetch(`/api/friend/files/${friendId}/page/${pageId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update pagination metadata from server response
            if (data.currentPage !== undefined) this.currentPage = data.currentPage;
            if (data.totalPages !== undefined) this.totalPages = data.totalPages;
            if (data.totalItems !== undefined) this.totalItems = data.totalItems;
            
            // Update the media gallery with new data
            this.updateMediaGallery(data);
            
            // Re-render pagination with updated data
            this.renderPagination();
            
            return true;
        } catch (error) {
            console.error('Error fetching page data:', error);
            return false;
        }
    },

    // Update media gallery with new data
    updateMediaGallery: function(data) {
        const mediaGallery = document.querySelector('.media-gallery');
        if (!mediaGallery) return;
        
        // Clear existing media items (but keep the no-media-placeholder logic)
        const existingItems = mediaGallery.querySelectorAll('.media-item');
        existingItems.forEach(item => item.remove());
        
        // Remove existing no-media placeholder if it exists
        const existingPlaceholder = mediaGallery.querySelector('.no-media-placeholder');
        if (existingPlaceholder) {
            existingPlaceholder.remove();
        }
        
        let hasMedia = false;
        
        // Add photos
        if (data.photos && data.photos.length > 0) {
            data.photos.forEach(photo => {
                const photoElement = this.createPhotoElement(photo);
                mediaGallery.appendChild(photoElement);
                hasMedia = true;
            });
        }
        
        // Add videos
        if (data.videos && data.videos.length > 0) {
            data.videos.forEach(video => {
                const videoElement = this.createVideoElement(video);
                mediaGallery.appendChild(videoElement);
                hasMedia = true;
            });
        }
        
        // Add resources
        if (data.resources && data.resources.length > 0) {
            data.resources.forEach(resource => {
                const resourceElement = this.createResourceElement(resource);
                mediaGallery.appendChild(resourceElement);
                hasMedia = true;
            });
        }
        
        // Show placeholder if no media
        if (!hasMedia) {
            this.showEmptyGalleryPlaceholder();
        }
    },

    // Create photo element
    createPhotoElement: function(photo) {
        const div = document.createElement('div');
        div.className = 'media-item';
        
        const img = document.createElement('img');
        img.src = `/api/fileRepository/file/${this.paginationFriendId}/${photo.photoName}`;
        img.alt = photo.photoName;
        img.setAttribute('data-photo-name', photo.photoName);
        img.setAttribute('data-media-name', photo.photoName);
        img.setAttribute('data-friend-id', this.paginationFriendId);
        img.setAttribute('data-photo-id', photo.id);
        img.setAttribute('data-media-id', photo.id);
        img.setAttribute('data-media-type', 'photo');
        img.onclick = function() { openMediaModalFromElement(this); };
        
        div.appendChild(img);
        return div;
    },

    // Create video element
    createVideoElement: function(video) {
        const div = document.createElement('div');
        div.className = 'media-item video';
        
        const videoThumbnail = document.createElement('div');
        videoThumbnail.className = 'video-thumbnail';
        videoThumbnail.setAttribute('data-video-name', video.videoName);
        videoThumbnail.setAttribute('data-friend-id', this.paginationFriendId);
        videoThumbnail.setAttribute('data-video-id', video.id);
        videoThumbnail.setAttribute('data-media-id', video.id);
        videoThumbnail.setAttribute('data-media-type', 'video');
        videoThumbnail.onclick = function() { openMediaModalFromElement(this); };
        
        const videoIndicator = document.createElement('div');
        videoIndicator.className = 'video-indicator';
        videoIndicator.textContent = '▶';
        
        videoThumbnail.appendChild(videoIndicator);
        div.appendChild(videoThumbnail);
        return div;
    },

    // Create resource element
    createResourceElement: function(resource) {
        const div = document.createElement('div');
        div.className = 'media-item resource';
        
        const resourceItem = document.createElement('div');
        resourceItem.className = 'resource-item';
        resourceItem.setAttribute('data-resource-name', resource.resourceName);
        resourceItem.setAttribute('data-friend-id', this.paginationFriendId);
        resourceItem.setAttribute('data-mime-type', resource.mimeType);
        resourceItem.setAttribute('data-media-id', resource.id);
        resourceItem.setAttribute('data-media-type', 'resource');
        resourceItem.onclick = function() { openMediaModalFromElement(this); };
        
        // Create resource icon
        const resourceIcon = document.createElement('div');
        resourceIcon.className = 'resource-icon';
        
        const iconSpan = document.createElement('span');
        if (resource.mimeType.includes('pdf')) {
            iconSpan.textContent = '📄';
        } else if (resource.mimeType.includes('document') || resource.mimeType.includes('word')) {
            iconSpan.textContent = '📝';
        } else if (resource.mimeType.includes('spreadsheet') || resource.mimeType.includes('excel')) {
            iconSpan.textContent = '📊';
        } else if (resource.mimeType.includes('text')) {
            iconSpan.textContent = '📋';
        } else {
            iconSpan.textContent = '📁';
        }
        
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

    // Show loading state
    showLoadingState: function() {
        const mediaGallery = document.querySelector('.media-gallery');
        if (!mediaGallery) return;
        
        // Add loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'mediaLoadingOverlay';
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            border-radius: 8px;
        `;
        
        const loadingText = document.createElement('div');
        loadingText.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 16px;
            color: #666;
        `;
        loadingText.innerHTML = '<div style="animate: spin 1s linear infinite;">⏳</div> Loading...';
        
        loadingOverlay.appendChild(loadingText);
        
        // Make media gallery relative positioned for overlay
        const originalPosition = mediaGallery.style.position;
        mediaGallery.style.position = 'relative';
        mediaGallery.appendChild(loadingOverlay);
        
        // Store original position to restore later
        loadingOverlay.setAttribute('data-original-position', originalPosition);
    },

    // Hide loading state
    hideLoadingState: function() {
        const loadingOverlay = document.getElementById('mediaLoadingOverlay');
        if (loadingOverlay) {
            const mediaGallery = loadingOverlay.parentElement;
            const originalPosition = loadingOverlay.getAttribute('data-original-position');
            
            loadingOverlay.remove();
            
            // Restore original position
            if (mediaGallery && originalPosition !== null) {
                mediaGallery.style.position = originalPosition;
            }
        }
    },

    // Show error message
    showErrorMessage: function(message) {
        // Create error notification
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i style="color: #ef4444;">❌</i>
                <span>${message}</span>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fef2f2;
            border: 1px solid #ef4444;
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Animate out and remove
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    },

    // Function to update pagination from backend data
    updatePaginationData: function(newCurrentPage, newTotalPages, newTotalItems) {
        this.currentPage = newCurrentPage;
        this.totalPages = newTotalPages;
        this.totalItems = newTotalItems;
        this.renderPagination();
    },

    // Show empty gallery placeholder (moved from profile.js)
    showEmptyGalleryPlaceholder: function() {
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
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    Pagination.init();
});
