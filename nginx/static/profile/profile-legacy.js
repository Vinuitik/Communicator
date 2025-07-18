/**
 * Legacy Profile.js - Simplified Version
 * This file provides backward compatibility for any legacy code that might depend on the old structure
 */

// Re-export functions for backward compatibility
function openMediaModalFromElement(element) {
    if (typeof MediaModal !== 'undefined') {
        MediaModal.openFromElement(element);
    }
}

function setPrimaryPhoto() {
    if (typeof PrimaryPhoto !== 'undefined') {
        PrimaryPhoto.setCurrent();
    }
}

function closeMediaModal() {
    if (typeof MediaModal !== 'undefined') {
        MediaModal.close();
    }
}

// Legacy global variables for compatibility
let currentMediaName = '';
let currentMediaType = '';
let currentFriendId = '';
let currentMimeType = '';
let currentMediaId = '';

// Update legacy globals when modal state changes
function updateLegacyGlobals() {
    if (typeof MediaModal !== 'undefined') {
        const currentMedia = MediaModal.getCurrentMedia();
        currentMediaName = currentMedia.name || '';
        currentMediaType = currentMedia.type || '';
        currentFriendId = currentMedia.friendId || '';
        currentMimeType = currentMedia.mimeType || '';
        currentMediaId = currentMedia.id || '';
    }
}

// Legacy initialization function
function initializeMediaModal() {
    if (typeof MediaModal !== 'undefined') {
        MediaModal.init();
    }
}

function initializeMediaUploadButton() {
    if (typeof MediaUpload !== 'undefined') {
        MediaUpload.init();
    }
}

// Legacy format file size function
function formatFileSize(bytes) {
    if (typeof Utils !== 'undefined') {
        return Utils.formatFileSize(bytes);
    }
    // Fallback implementation
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Legacy show success message function
function showSuccessMessage(message) {
    if (typeof NotificationManager !== 'undefined') {
        NotificationManager.showSuccess(message);
    }
}

console.log('Legacy profile.js compatibility layer loaded');
