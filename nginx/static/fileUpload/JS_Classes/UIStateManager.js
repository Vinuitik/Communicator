// UI state management
class UIStateManager {
    constructor(fileCount, emptyState, uploadBtn) {
        this.fileCount = fileCount;
        this.emptyState = emptyState;
        this.uploadBtn = uploadBtn;
    }
    
    update(files) {
        const count = files.length;
        
        // Update file count
        this.fileCount.textContent = count;
        
        // Show/hide empty state
        if (count === 0) {
            this.emptyState.style.display = 'block';
            this.uploadBtn.disabled = true;
        } else {
            this.emptyState.style.display = 'none';
            this.uploadBtn.disabled = false;
        }
        
        // Update upload button text
        this.uploadBtn.textContent = count === 0 ? 'Upload Files' : 
            `Upload ${count} File${count === 1 ? '' : 's'}`;
    }
}
