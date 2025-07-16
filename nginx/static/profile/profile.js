// Global variables
let currentMediaName = '';
let currentMediaType = '';
let currentFriendId = '';
let currentMimeType = '';
let currentMediaId = '';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeMediaModal();
    initializeMediaUploadButton();
});

// Initialize media upload button
function initializeMediaUploadButton() {
    const mediaUploadButton = document.getElementById('mediaUploadButton');
    if (mediaUploadButton) {
        mediaUploadButton.addEventListener('click', () => {
            window.location.href = '/fileUpload/' + window.location.pathname.split('/').pop();
        });
    }
}

// Initialize modal functionality
function initializeMediaModal() {
    const modal = document.getElementById('mediaModal');
    const closeBtn = document.getElementById('closeMediaModal');
    const closeModalBtn = document.getElementById('closeMediaBtn');
    const deleteBtn = document.getElementById('deleteMediaBtn');

    // Close modal events
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMediaModal);
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeMediaModal);
    }

    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeMediaModal();
            }
        });
    }

    // Keyboard events
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isModalVisible()) {
            closeMediaModal();
        }
    });

    // Delete button functionality
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteCurrentMedia);
    }
}

// Check if modal is visible
function isModalVisible() {
    const modal = document.getElementById('mediaModal');
    return modal && (modal.style.display === 'block' || 
           (modal.style.display === '' && window.getComputedStyle(modal).display === 'block'));
}

function generateMediaPreview(fileName, type, friendId, mimeType) {
    const previewContainer = document.getElementById('mediaPreviewContainer');
    const fileUrl = `/api/fileRepository/file/${friendId}/${fileName}`;
    let previewHTML = '';

    switch (type) {
        case 'photo':
            previewHTML = `<img src="${fileUrl}" alt="${fileName}" class="media-preview-image">`;
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
            if (mimeType && mimeType.includes('pdf')) {
                previewHTML = `
                    <iframe src="${fileUrl}" style="width: 100%; height: 500px; border: none; border-radius: 8px;"></iframe>
                `;
            } else if (mimeType && mimeType.includes('image')) {
                previewHTML = `<img src="${fileUrl}" alt="${fileName}" class="media-preview-image">`;
            } else {
                // Get appropriate icon based on mime type
                let icon = '📁';
                if (mimeType) {
                    if (mimeType.includes('pdf')) icon = '📄';
                    else if (mimeType.includes('document') || mimeType.includes('word')) icon = '📝';
                    else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) icon = '📊';
                    else if (mimeType.includes('text')) icon = '📋';
                    else if (mimeType.includes('audio')) icon = '🎵';
                    else if (mimeType.includes('video')) icon = '🎥';
                    else if (mimeType.includes('archive') || mimeType.includes('zip')) icon = '📦';
                }
                
                previewHTML = `
                    <div class="media-preview-document">
                        <i style="font-size: 64px; margin-bottom: 16px;">${icon}</i>
                        <h4>${fileName}</h4>
                        <p>Preview not available for this file type</p>
                        <a href="${fileUrl}" target="_blank" class="media-btn media-btn-secondary" style="margin-top: 15px; text-decoration: none;">
                            Open in New Tab
                        </a>
                    </div>
                `;
            }
            break;
            
        default:
            previewHTML = `
                <div class="media-preview-document">
                    <i style="font-size: 64px; color: #666; margin-bottom: 16px;">📁</i>
                    <h4>${fileName}</h4>
                    <p>Preview not available for this file type</p>
                </div>
            `;
            break;
    }

    previewContainer.innerHTML = previewHTML;
}

// Fetch media file information
async function fetchMediaInfo(fileName, friendId) {
    try {
        const response = await fetch(`/api/fileRepository/info/${friendId}/${fileName}`);
        if (response.ok) {
            const info = await response.json();
            const mediaSize = document.getElementById('modalMediaSize');
            if (mediaSize && info.size) {
                mediaSize.textContent = formatFileSize(info.size);
            }
        }
    } catch (error) {
        console.warn('Could not fetch media info:', error);
        const mediaSize = document.getElementById('modalMediaSize');
        if (mediaSize) {
            mediaSize.textContent = 'Unknown';
        }
    }
}

// Close media modal
function closeMediaModal() {
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
    
    // Reset current media variables
    currentMediaName = '';
    currentMediaType = '';
    currentFriendId = '';
    currentMimeType = '';
}

// Even cleaner approach - let's create a new function that can be called with just the clicked element
function openMediaModalFromElement(element) {
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

    currentMediaName = fileName;
    currentMediaType = mediaType;
    currentFriendId = friendId;
    currentMimeType = mimeType;
    currentMediaId = mediaId;

    const modal = document.getElementById('mediaModal');
    const modalTitle = document.getElementById('mediaModalTitle');
    const previewContainer = document.getElementById('mediaPreviewContainer');
    const mediaName = document.getElementById('modalMediaName');
    const mediaTypeSpan = document.getElementById('modalMediaType');

    if (!modal || !previewContainer) {
        console.error('Modal elements not found');
        return;
    }

    // Update modal title and info
    modalTitle.textContent = fileName;
    mediaName.textContent = fileName;
    mediaTypeSpan.textContent = mediaType === 'resource' ? (mimeType || 'Unknown') : mediaType;
    
    // Generate preview content
    generateMediaPreview(fileName, mediaType, friendId, mimeType);
    
    // Fetch and display file size
    fetchMediaInfo(fileName, friendId);

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    modal.offsetHeight;
}

// Delete current media - improved version without page reload
async function deleteCurrentMedia() {
    if (!currentMediaName || !currentFriendId || !currentMediaId) {
        console.error('No media selected for deletion');
        return;
    }

    const confirmed = confirm(`Are you sure you want to delete "${currentMediaName}"?`);
    if (!confirmed) {
        return;
    }

    // Show loading state on delete button
    const deleteBtn = document.getElementById('deleteMediaBtn');
    const originalBtnText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i>⏳</i> Deleting...';

    try {
        const formData = new FormData();
        
        // Initialize empty arrays for all media types
        const photoIds = [];
        const videoIds = [];
        const resourceIds = [];
        
        // Add the current media ID to the appropriate array based on type
        switch (currentMediaType) {
            case 'photo':
                photoIds.push(currentMediaId);
                break;
            case 'video':
                videoIds.push(currentMediaId);
                break;
            case 'resource':
                resourceIds.push(currentMediaId);
                break;
            default:
                console.error('Unknown media type:', currentMediaType);
                return;
        }
        
        // Add all arrays to form data
        formData.append('photos', photoIds);
        formData.append('videos', videoIds);
        formData.append('resources', resourceIds);
        formData.append('friendId', currentFriendId);

        console.log("formData being sent:", formData);

        const response = await fetch('/api/friend/files/delete', {
            method: 'POST',
            body: formData
        });

        console.log("Response status:", response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('Delete response:', result);
            
            // Close modal first
            closeMediaModal();
            
            // Remove the media item from DOM
            removeMediaFromDOM(currentMediaId, currentMediaType);
            
            // Show success feedback
            showSuccessMessage(`"${currentMediaName}" has been deleted successfully.`);
            
        } else {
            const error = await response.text();
            alert('Failed to delete media: ' + error);
        }
    } catch (error) {
        console.error('Error deleting media:', error);
        alert('Failed to delete media. Please try again.');
    } finally {
        // Restore delete button
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalBtnText;
    }
}

// Remove media item from DOM
function removeMediaFromDOM(mediaId, mediaType) {
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
                updateGalleryState();
                
                // Update pagination if needed
                updatePaginationAfterDelete();
                
            }, 300);
        } else {
            // Fallback: remove the media element directly if no container found
            mediaElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            mediaElement.style.opacity = '0';
            mediaElement.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                mediaElement.remove();
                updateGalleryState();
                updatePaginationAfterDelete();
            }, 300);
        }
    } else {
        console.warn('Media element not found in DOM, falling back to page reload');
        window.location.reload();
    }
}

// Update gallery state after deletion
function updateGalleryState() {
    const mediaGallery = document.querySelector('.media-gallery');
    if (!mediaGallery) return;
    
    // Count remaining media items
    const remainingPhotos = mediaGallery.querySelectorAll('[data-media-type="photo"]').length;
    const remainingVideos = mediaGallery.querySelectorAll('[data-media-type="video"]').length;
    const remainingResources = mediaGallery.querySelectorAll('[data-media-type="resource"]').length;
    
    const totalRemaining = remainingPhotos + remainingVideos + remainingResources;
    
    // If no media left, show placeholder
    if (totalRemaining === 0) {
        showEmptyGalleryPlaceholder();
    }
    
    // Update any counters or section headers if they exist
    updateMediaCounts(remainingPhotos, remainingVideos, remainingResources);
}

// Show empty gallery placeholder
function showEmptyGalleryPlaceholder() {
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

// Update media counts (if you have counters displayed anywhere)
function updateMediaCounts(photoCount, videoCount, resourceCount) {
    // Update section title or any counters you might have
    const sectionTitle = document.querySelector('.media-gallery').closest('.profile-section')?.querySelector('.section-title');
    if (sectionTitle && !sectionTitle.textContent.includes('Media Gallery')) {
        // Only update if there are actual counters to update
        console.log(`Updated counts - Photos: ${photoCount}, Videos: ${videoCount}, Resources: ${resourceCount}`);
    }
}

// Update pagination after deletion
function updatePaginationAfterDelete() {
    // Check if pagination.js is loaded and update
    if (typeof updatePaginationData === 'function') {
        // Decrease total items by 1
        const newTotalItems = Math.max(0, totalItems - 1);
        
        // Recalculate total pages (assuming items per page, you might need to adjust this)
        const itemsPerPage = 12; // Adjust based on your pagination setup
        const newTotalPages = Math.max(1, Math.ceil(newTotalItems / itemsPerPage));
        
        // Check if current page is now empty and should go to previous page
        let newCurrentPage = currentPage;
        if (currentPage > newTotalPages) {
            newCurrentPage = newTotalPages;
        }
        
        // Update pagination
        updatePaginationData(newCurrentPage, newTotalPages, newTotalItems);
    }
}

// Show success message
function showSuccessMessage(message) {
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i style="color: #22c55e;">✅</i>
            <span>${message}</span>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f0f9ff;
        border: 1px solid #22c55e;
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
    }, 3000);
}

// Format file size helper function (if not already defined)
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}