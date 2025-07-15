// Global variables
let currentMediaName = '';
let currentMediaType = '';
let currentFriendId = '';
let currentMimeType = '';

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

// Open media modal
function openMediaModal(fileName, type, friendId, mimeType = '') {
    currentMediaName = fileName;
    currentMediaType = type;
    currentFriendId = friendId;
    currentMimeType = mimeType;

    const modal = document.getElementById('mediaModal');
    const modalTitle = document.getElementById('mediaModalTitle');
    const previewContainer = document.getElementById('mediaPreviewContainer');
    const mediaName = document.getElementById('modalMediaName');
    const mediaType = document.getElementById('modalMediaType');
    const mediaSize = document.getElementById('modalMediaSize');

    if (!modal || !previewContainer) {
        console.error('Modal elements not found');
        return;
    }

    // Update modal title and info
    modalTitle.textContent = fileName;
    mediaName.textContent = fileName;
    mediaType.textContent = type === 'resource' ? (mimeType || 'Unknown') : type;
    
    // Generate preview content
    generateMediaPreview(fileName, type, friendId, mimeType);
    
    // Fetch and display file size
    fetchMediaInfo(fileName, friendId);

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Force reflow for better browser compatibility
    modal.offsetHeight;
}

// Generate media preview content
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

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

// Delete current media
async function deleteCurrentMedia() {
    if (!currentMediaName || !currentFriendId) {
        console.error('No media selected for deletion');
        return;
    }

    const confirmed = confirm(`Are you sure you want to delete "${currentMediaName}"?`);
    if (!confirmed) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append('files', currentMediaName);
        formData.append('friendId', currentFriendId);

        const response = await fetch(`/api/friend/files/delete`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            closeMediaModal();
            // Reload the page to update the media gallery
            window.location.reload();
        } else {
            const error = await response.text();
            alert('Failed to delete media: ' + error);
        }
    } catch (error) {
        console.error('Error deleting media:', error);
        alert('Failed to delete media. Please try again.');
    }
}

// Legacy functions for backward compatibility (in case they're called from somewhere else)
function viewMedia(fileName, type) {
    const friendId = window.location.pathname.split('/').pop();
    openMediaModal(fileName, type, friendId);
}

function viewResource(fileName) {
    const friendId = window.location.pathname.split('/').pop();
    openMediaModal(fileName, 'resource', friendId);
}