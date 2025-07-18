/**
 * Profile Application Main Module
 * Initializes and coordinates all profile page modules
 */

const ProfileApp = {
    /**
     * Initialize the entire profile application
     */
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeModules());
        } else {
            this.initializeModules();
        }
    },

    /**
     * Initialize all modules in the correct order
     */
    initializeModules() {
        try {
            // Initialize core modules first
            console.log('Initializing Profile App modules...');
            
            // Initialize media modal functionality
            if (typeof MediaModal !== 'undefined') {
                MediaModal.init();
                console.log('✓ MediaModal initialized');
            }
            
            // Initialize media upload functionality
            if (typeof MediaUpload !== 'undefined') {
                MediaUpload.init();
                console.log('✓ MediaUpload initialized');
            }
            
            // Initialize pagination (this also handles gallery updates)
            if (typeof Pagination !== 'undefined') {
                Pagination.init();
                console.log('✓ Pagination initialized');
            }
            
            console.log('✓ Profile App fully initialized');
            
        } catch (error) {
            console.error('Error initializing Profile App:', error);
            NotificationManager.showError('Failed to initialize profile page. Please refresh the page.');
        }
    },

    /**
     * Get application state for debugging
     * @returns {Object} Current application state
     */
    getState() {
        return {
            pagination: {
                currentPage: Pagination?.currentPage || 'N/A',
                totalPages: Pagination?.totalPages || 'N/A',
                totalItems: Pagination?.totalItems || 'N/A',
                friendId: Pagination?.friendId || 'N/A'
            },
            mediaModal: {
                isVisible: MediaModal?.isVisible() || false,
                currentMedia: MediaModal?.getCurrentMedia() || {}
            }
        };
    }
};

// Initialize the application
ProfileApp.init();
