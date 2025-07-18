/**
 * Media Upload Module
 * Handles media upload button functionality
 */

const MediaUpload = {
    /**
     * Initialize media upload functionality
     */
    init() {
        this.setupUploadButton();
    },

    /**
     * Setup the media upload button event listener
     */
    setupUploadButton() {
        const mediaUploadButton = document.getElementById('mediaUploadButton');
        if (mediaUploadButton) {
            mediaUploadButton.addEventListener('click', () => {
                this.redirectToUpload();
            });
        }
    },

    /**
     * Redirect to file upload page
     */
    redirectToUpload() {
        const friendId = window.location.pathname.split('/').pop();
        window.location.href = `/fileUpload/${friendId}`;
    }
};
