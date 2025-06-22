class FileUtilities {
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    static truncateFileName(fileName, maxLength = 30) {
        if (fileName.length <= maxLength) return fileName;
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';
        return truncatedName + '.' + extension;
    }
    
    static getFileCategory(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType === 'application/pdf') return 'pdf';
        return 'default';
    }
    
    static getFileIcon(category) {
        const icons = {
            image: '<i class="fas fa-file-image"></i>',
            video: '<i class="fas fa-file-video"></i>',
            audio: '<i class="fas fa-file-audio"></i>',
            pdf: '<i class="fas fa-file-pdf"></i>',
            default: '<i class="fas fa-file"></i>'
        };
        return icons[category] || icons.default;
    }
}