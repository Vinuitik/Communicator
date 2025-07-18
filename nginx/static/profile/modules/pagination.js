/**
 * Pagination Module
 * Handles media gallery pagination functionality
 */

const Pagination = {
    // Pagination state
    currentPage: 1,
    totalPages: 5,
    totalItems: 48,
    friendId: null,
    itemsPerPage: 12,
    
    /**
     * Initialize pagination system
     */
    init() {
        this.extractFriendId();
        this.setupEventListeners();
        this.loadInitialPage();
    },
    
    /**
     * Extract friend ID from page elements
     */
    extractFriendId() {
        const mediaItems = document.querySelectorAll('[data-friend-id]');
        if (mediaItems.length > 0) {
            this.friendId = mediaItems[0].getAttribute('data-friend-id');
        } else {
            this.friendId = Utils.getFriendIdFromUrl();
        }
    },
    
    /**
     * Setup event listeners for pagination controls
     */
    setupEventListeners() {
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
            goBtn.addEventListener('click', () => this.goToCustomPage());
        }

        if (pageInput) {
            pageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.goToCustomPage();
                }
            });
        }

        this.render();
    },

    /**
     * Load initial page to get correct pagination metadata
     */
    async loadInitialPage() {
        try {
            const success = await this.loadPage(1);
            if (success) {
                console.log(`Pagination initialized: ${this.totalItems} items across ${this.totalPages} pages`);
            }
        } catch (error) {
            console.error('Error loading initial page data:', error);
        }
    },

    /**
     * Load specific page of media
     * @param {number} pageNumber - Page number to load
     * @returns {boolean} Success status
     */
    async loadPage(pageNumber) {
        try {
            LoadingState.show();
            
            const response = await fetch(`/api/friend/files/${this.friendId}/page/${pageNumber}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update pagination metadata from server response
            this.updateFromServerData(data);
            
            // Update the media gallery with new data
            this.updateGallery(data);
            
            // Re-render pagination controls
            this.render();
            
            return true;
        } catch (error) {
            console.error('Error fetching page data:', error);
            NotificationManager.showError('Failed to load page. Please try again.');
            return false;
        } finally {
            LoadingState.hide();
        }
    },

    /**
     * Update pagination data from server response
     * @param {Object} data - Server response data
     */
    updateFromServerData(data) {
        if (data.currentPage !== undefined) this.currentPage = data.currentPage;
        if (data.totalPages !== undefined) this.totalPages = data.totalPages;
        if (data.totalItems !== undefined) this.totalItems = data.totalItems;
    },

    /**
     * Update media gallery with new data
     * @param {Object} data - Media data from server
     */
    updateGallery(data) {
        GalleryManager.clearAllItems();
        GalleryManager.addMediaItems(data.photos, data.videos, data.resources, this.friendId);
    },

    /**
     * Render pagination controls
     */
    render() {
        this.updateNavigationButtons();
        this.renderPageNumbers();
        this.updatePageInfo();
    },

    /**
     * Update previous/next navigation buttons
     */
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === this.totalPages;
        }
    },

    /**
     * Render page number buttons
     */
    renderPageNumbers() {
        const paginationNumbers = document.getElementById('paginationNumbers');
        if (!paginationNumbers) return;

        paginationNumbers.innerHTML = '';

        if (this.totalPages <= 5) {
            // Show all pages if 5 or fewer
            for (let i = 1; i <= this.totalPages; i++) {
                paginationNumbers.appendChild(this.createPageButton(i));
            }
        } else {
            // Complex pagination with input field
            this.renderComplexPagination(paginationNumbers);
        }
    },

    /**
     * Render complex pagination for many pages
     * @param {HTMLElement} container - Container element for pagination
     */
    renderComplexPagination(container) {
        if (this.currentPage <= 3) {
            // Show: 1 2 3 [input] ... totalPages
            for (let i = 1; i <= 3; i++) {
                container.appendChild(this.createPageButton(i));
            }
            container.appendChild(this.createInputContainer());
            container.appendChild(this.createPageButton(this.totalPages));
        } else if (this.currentPage >= this.totalPages - 2) {
            // Show: 1 ... [input] (totalPages-2) (totalPages-1) totalPages
            container.appendChild(this.createPageButton(1));
            container.appendChild(this.createInputContainer());
            for (let i = this.totalPages - 2; i <= this.totalPages; i++) {
                container.appendChild(this.createPageButton(i));
            }
        } else {
            // Show: 1 ... [input] ... totalPages
            container.appendChild(this.createPageButton(1));
            container.appendChild(this.createInputContainer());
            container.appendChild(this.createPageButton(this.totalPages));
        }
    },

    /**
     * Create page number button
     * @param {number} pageNumber - Page number
     * @returns {HTMLElement} Page button element
     */
    createPageButton(pageNumber) {
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

    /**
     * Create input container for page jumping
     * @returns {HTMLElement} Input container element
     */
    createInputContainer() {
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
        button.addEventListener('click', () => this.goToCustomPage());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.goToCustomPage();
            }
        });
        
        container.appendChild(input);
        container.appendChild(button);
        
        return container;
    },

    /**
     * Update page information display
     */
    updatePageInfo() {
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages} • ${this.totalItems} items`;
        }
    },

    /**
     * Go to specific page
     * @param {number} page - Page number to navigate to
     */
    async goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }
        
        const success = await this.loadPage(page);
        if (success) {
            this.currentPage = page;
        }
    },

    /**
     * Go to page from input field
     */
    goToCustomPage() {
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

    /**
     * Update pagination after item deletion
     */
    updateAfterDeletion() {
        // Decrease total items by 1
        const newTotalItems = Math.max(0, this.totalItems - 1);
        
        // Recalculate total pages
        const newTotalPages = Math.max(1, Math.ceil(newTotalItems / this.itemsPerPage));
        
        // Check if current page is now empty and should go to previous page
        let newCurrentPage = this.currentPage;
        if (this.currentPage > newTotalPages) {
            newCurrentPage = newTotalPages;
        }
        
        // Update pagination data
        this.updateData(newCurrentPage, newTotalPages, newTotalItems);
    },

    /**
     * Update pagination data and re-render
     * @param {number} newCurrentPage - New current page
     * @param {number} newTotalPages - New total pages
     * @param {number} newTotalItems - New total items
     */
    updateData(newCurrentPage, newTotalPages, newTotalItems) {
        this.currentPage = newCurrentPage;
        this.totalPages = newTotalPages;
        this.totalItems = newTotalItems;
        this.render();
    }
};

/**
 * Loading State Module
 * Handles showing/hiding loading states for pagination
 */
const LoadingState = {
    /**
     * Show loading overlay on media gallery
     */
    show() {
        const mediaGallery = document.querySelector('.media-gallery');
        if (!mediaGallery) return;
        
        // Remove existing overlay
        this.hide();
        
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
        loadingText.innerHTML = '<div style="animation: spin 1s linear infinite;">⏳</div> Loading...';
        
        loadingOverlay.appendChild(loadingText);
        
        // Make media gallery relative positioned for overlay
        const originalPosition = mediaGallery.style.position;
        mediaGallery.style.position = 'relative';
        mediaGallery.appendChild(loadingOverlay);
        
        // Store original position to restore later
        loadingOverlay.setAttribute('data-original-position', originalPosition);
    },

    /**
     * Hide loading overlay
     */
    hide() {
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
    }
};
