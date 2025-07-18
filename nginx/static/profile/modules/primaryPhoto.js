/**
 * Primary Photo Module
 * Handles setting and managing primary photos for friends
 */

const PrimaryPhoto = {
    /**
     * Update primary photo button visibility and state
     * @param {string} mediaType - The type of media (photo, video, resource)
     */
    updateButton(mediaType) {
        const primaryPhotoBtn = document.getElementById('setPrimaryPhotoBtn');
        
        if (mediaType === 'photo') {
            if (primaryPhotoBtn) {
                primaryPhotoBtn.style.display = 'block';
                this.checkIfPrimary();
            }
        } else {
            if (primaryPhotoBtn) {
                primaryPhotoBtn.style.display = 'none';
            }
        }
    },

    /**
     * Check if current photo is already the primary photo
     */
    async checkIfPrimary() {
        const currentMedia = MediaModal.getCurrentMedia();
        
        try {
            const response = await fetch(`/api/friend/${currentMedia.friendId}/primary-photo`);
            if (response.ok) {
                const result = await response.json();
                const primaryPhotoBtn = document.getElementById('setPrimaryPhotoBtn');
                
                if (result.primaryPhotoId && result.primaryPhotoId == currentMedia.id) {
                    // This is already the primary photo
                    if (primaryPhotoBtn) {
                        primaryPhotoBtn.innerHTML = '<i>⭐</i> Primary Photo';
                        primaryPhotoBtn.disabled = true;
                        primaryPhotoBtn.classList.add('primary-active');
                    }
                } else {
                    // Not primary photo
                    if (primaryPhotoBtn) {
                        primaryPhotoBtn.innerHTML = '<i>⭐</i> Set as Primary';
                        primaryPhotoBtn.disabled = false;
                        primaryPhotoBtn.classList.remove('primary-active');
                    }
                }
            }
        } catch (error) {
            console.warn('Could not check primary photo status:', error);
        }
    },

    /**
     * Set current photo as primary
     */
    async setCurrent() {
        const currentMedia = MediaModal.getCurrentMedia();
        
        if (!currentMedia.id || !currentMedia.friendId || currentMedia.type !== 'photo') {
            console.error('Invalid photo for setting as primary');
            return;
        }

        const primaryPhotoBtn = document.getElementById('setPrimaryPhotoBtn');
        if (!primaryPhotoBtn) return;
        
        const originalBtnText = primaryPhotoBtn.innerHTML;
        
        // Show loading state
        primaryPhotoBtn.disabled = true;
        primaryPhotoBtn.innerHTML = '<i>⏳</i> Setting...';

        try {
            const formData = new FormData();
            formData.append('friendId', currentMedia.friendId);
            formData.append('photoId', currentMedia.id);

            const response = await fetch('/api/friend/set-primary-photo', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Primary photo set:', result);
                
                // Update button state
                primaryPhotoBtn.innerHTML = '<i>⭐</i> Primary Photo';
                primaryPhotoBtn.classList.add('primary-active');
                
                // Update profile header image
                this.updateProfileHeaderImage(currentMedia);
                
                // Show success message
                NotificationManager.showSuccess(`"${currentMedia.name}" is now the primary photo!`);
                
            } else {
                const error = await response.text();
                alert('Failed to set primary photo: ' + error);
                // Restore button
                primaryPhotoBtn.innerHTML = originalBtnText;
                primaryPhotoBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error setting primary photo:', error);
            alert('Failed to set primary photo. Please try again.');
            // Restore button
            primaryPhotoBtn.innerHTML = originalBtnText;
            primaryPhotoBtn.disabled = false;
        }
    },

    /**
     * Update profile header image with new primary photo
     * @param {Object} mediaData - Current media data
     */
    updateProfileHeaderImage(mediaData) {
        const profileHeaderImg = document.querySelector('.profile-header img');
        if (profileHeaderImg && mediaData.name) {
            const newImageUrl = `/api/fileRepository/file/${mediaData.friendId}/${mediaData.name}`;
            profileHeaderImg.src = newImageUrl;
            
            // Add a subtle animation to indicate change
            profileHeaderImg.style.transition = 'opacity 0.3s ease-out';
            profileHeaderImg.style.opacity = '0.7';
            setTimeout(() => {
                profileHeaderImg.style.opacity = '1';
            }, 150);
        }
    }
};

// Global function for backward compatibility
function setPrimaryPhoto() {
    PrimaryPhoto.setCurrent();
}
