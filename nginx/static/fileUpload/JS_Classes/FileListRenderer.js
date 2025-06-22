// File list UI rendering
class FileListRenderer {
    constructor(container, onFileClick, onFileRemove) {
        this.container = container;
        this.onFileClick = onFileClick;
        this.onFileRemove = onFileRemove;
    }
    
    render(files) {
        this.container.innerHTML = '';
        files.forEach(fileObj => this.createFileItem(fileObj));
    }
    
    createFileItem(fileObj) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.fileId = fileObj.id;
        fileItem.dataset.type = fileObj.category;
        fileItem.title = 'Click to preview';
        
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-icon">${FileUtilities.getFileIcon(fileObj.category)}</div>
                <div class="file-details">
                    <div class="file-name" title="${fileObj.name}">${FileUtilities.truncateFileName(fileObj.name)}</div>
                    <div class="file-size">${FileUtilities.formatFileSize(fileObj.size)}</div>
                </div>
            </div>
            <button class="remove-file" title="Remove file">×</button>
        `;
        
        // Add click events
        fileItem.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-file')) {
                this.onFileClick(fileObj.id);
            }
        });
        
        const removeBtn = fileItem.querySelector('.remove-file');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onFileRemove(fileObj.id);
        });
        
        this.container.appendChild(fileItem);
    }
}