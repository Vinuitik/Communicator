// File validation logic
class FileValidator {
    constructor(maxFiles = 10, maxFileSize = 50 * 1024 * 1024) {
        this.maxFiles = maxFiles;
        this.maxFileSize = maxFileSize;
    }
    
    validateFile(file, existingFiles) {
        // Check file count limit
        if (existingFiles.length >= this.maxFiles) {
            alert(`Maximum ${this.maxFiles} files allowed`);
            return false;
        }
        
        // Check file size
        if (file.size > this.maxFileSize) {
            alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
            return false;
        }
        
        // Check if file already exists
        const exists = existingFiles.some(f => f.name === file.name && f.size === file.size);
        if (exists) {
            alert(`File "${file.name}" is already selected.`);
            return false;
        }
        
        return true;
    }
}