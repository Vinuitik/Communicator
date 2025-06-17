class FileUploader {
    constructor() {
        this.files = [];
        this.maxFiles = 10;
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
        this.currentPreviewFile = null;
        
        // Get DOM elements
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.filesContainer = document.getElementById('filesContainer');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.fileCount = document.getElementById('fileCount');
        this.emptyState = document.getElementById('emptyState');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        // Modal elements
        this.previewModal = document.getElementById('previewModal');
        this.previewContainer = document.getElementById('previewContainer');
        this.previewFileName = document.getElementById('previewFileName');
        this.closeModal = document.getElementById('closeModal');
        
        this.init();
    }
    
    init() {
        // File input change event
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Button events
        this.uploadBtn.addEventListener('click', () => this.uploadFiles());
        this.clearBtn.addEventListener('click', () => this.clearAllFiles());
        
        // Modal events
        this.closeModal.addEventListener('click', () => this.closePreview());
        this.previewModal.addEventListener('click', (e) => {
            if (e.target === this.previewModal) this.closePreview();
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.previewModal.style.display === 'block') {
                this.closePreview();
            }
        });
        
        this.updateUI();
    }
    
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.addFiles(files);
        event.target.value = ''; // Reset input
    }
    
    handleDragOver(event) {
        event.preventDefault();
        this.uploadArea.classList.add('dragover');
    }
    
    handleDragLeave(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }
    
    handleDrop(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = Array.from(event.dataTransfer.files);
        this.addFiles(files);
    }
    
    addFiles(files) {
        files.forEach(file => {
            if (this.validateFile(file)) {
                const fileObj = {
                    id: Date.now() + Math.random().toString(36).substr(2, 9),
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    category: this.getFileCategory(file.type),
                    lastModified: new Date(file.lastModified)
                };
                
                this.files.push(fileObj);
                this.createFileItem(fileObj);
            }
        });
        
        this.updateUI();
    }
    
    validateFile(file) {
        // Check file count limit
        if (this.files.length >= this.maxFiles) {
            alert(`Maximum ${this.maxFiles} files allowed`);
            return false;
        }
        
        // Check file size
        if (file.size > this.maxFileSize) {
            alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
            return false;
        }
        
        // Check if file already exists
        const exists = this.files.some(f => f.name === file.name && f.size === file.size);
        if (exists) {
            alert(`File "${file.name}" is already selected.`);
            return false;
        }
        
        return true;
    }
    
    getFileCategory(mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType === 'application/pdf') return 'pdf';
        return 'default';
    }
    
    getFileIcon(category) {
        const icons = {
            image: '<i class="fas fa-file-image"></i>',
            video: '<i class="fas fa-file-video"></i>',
            audio: '<i class="fas fa-file-audio"></i>',
            pdf: '<i class="fas fa-file-pdf"></i>',
            default: '<i class="fas fa-file"></i>'
        };
        return icons[category] || icons.default;
    }
    
    createFileItem(fileObj) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.fileId = fileObj.id;
        fileItem.dataset.type = fileObj.category;
        fileItem.title = 'Click to preview';
        
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-icon">${this.getFileIcon(fileObj.category)}</div>
                <div class="file-details">
                    <div class="file-name" title="${fileObj.name}">${this.truncateFileName(fileObj.name)}</div>
                    <div class="file-size">${this.formatFileSize(fileObj.size)}</div>
                </div>
            </div>
            <button class="remove-file" onclick="event.stopPropagation(); fileUploader.removeFile('${fileObj.id}')" title="Remove file">
                ×
            </button>
        `;
        
        // Add click event for preview
        fileItem.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-file')) {
                this.showPreview(fileObj.id);
            }
        });
        
        this.filesContainer.appendChild(fileItem);
    }
    
    showPreview(fileId) {
        const fileObj = this.files.find(f => f.id === fileId);
        if (!fileObj) return;
        
        this.currentPreviewFile = fileObj;
        
        // Update modal title and file info
        this.previewFileName.textContent = fileObj.name;
        document.getElementById('modalFileName').textContent = fileObj.name;
        document.getElementById('modalFileSize').textContent = this.formatFileSize(fileObj.size);
        document.getElementById('modalFileType').textContent = fileObj.type || 'Unknown';
        document.getElementById('modalFileDate').textContent = fileObj.lastModified.toLocaleString();
        
        // Generate preview content
        this.generatePreviewContent(fileObj);
        
        // Show modal
        this.previewModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    generatePreviewContent(fileObj) {
        const category = fileObj.category;
        let previewHTML = '';
        
        switch (category) {
            case 'image':
                const imageUrl = URL.createObjectURL(fileObj.file);
                previewHTML = `<img src="${imageUrl}" alt="${fileObj.name}" class="preview-image">`;
                break;
                
            case 'video':
                const videoUrl = URL.createObjectURL(fileObj.file);
                previewHTML = `
                    <video controls class="preview-video">
                        <source src="${videoUrl}" type="${fileObj.type}">
                        Your browser does not support the video tag.
                    </video>
                `;
                break;
                
            case 'audio':
                const audioUrl = URL.createObjectURL(fileObj.file);
                previewHTML = `
                    <div class="preview-document">
                        <i class="fas fa-music"></i>
                        <h4>${fileObj.name}</h4>
                        <audio controls style="margin-top: 20px; width: 100%;">
                            <source src="${audioUrl}" type="${fileObj.type}">
                            Your browser does not support the audio tag.
                        </audio>
                    </div>
                `;
                break;
                
            case 'pdf':
                if (fileObj.file.type === 'application/pdf') {
                    const pdfUrl = URL.createObjectURL(fileObj.file);
                    previewHTML = `
                        <iframe src="${pdfUrl}" style="width: 100%; height: 400px; border: none; border-radius: 8px;"></iframe>
                    `;
                } else {
                    previewHTML = `
                        <div class="preview-document">
                            <i class="fas fa-file-pdf"></i>
                            <h4>PDF Document</h4>
                            <p>PDF preview not available</p>
                        </div>
                    `;
                }
                break;
                
            default:
                previewHTML = `
                    <div class="preview-document">
                        <i class="fas fa-file"></i>
                        <h4>${fileObj.name}</h4>
                        <p>Preview not available for this file type</p>
                    </div>
                `;
                break;
        }
        
        this.previewContainer.innerHTML = previewHTML;
    }
    
    closePreview() {
        this.previewModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore scrolling
        this.currentPreviewFile = null;
        
        // Clean up object URLs to prevent memory leaks
        const mediaElements = this.previewContainer.querySelectorAll('img, video, audio, iframe');
        mediaElements.forEach(el => {
            if (el.src && el.src.startsWith('blob:')) {
                URL.revokeObjectURL(el.src);
            }
        });
    }
    
    removeFileFromPreview() {
        if (this.currentPreviewFile) {
            this.removeFile(this.currentPreviewFile.id);
            this.closePreview();
        }
    }
    
    removeFile(fileId) {
        // Remove from files array
        this.files = this.files.filter(file => file.id !== fileId);
        
        // Remove from DOM
        const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileElement) {
            fileElement.remove();
        }
        
        this.updateUI();
    }
    
    clearAllFiles() {
        this.files = [];
        this.filesContainer.innerHTML = '';
        this.closePreview();
        this.updateUI();
    }
    
    updateUI() {
        const fileCount = this.files.length;
        
        // Update file count
        this.fileCount.textContent = fileCount;
        
        // Show/hide empty state
        if (fileCount === 0) {
            this.emptyState.style.display = 'block';
            this.uploadBtn.disabled = true;
        } else {
            this.emptyState.style.display = 'none';
            this.uploadBtn.disabled = false;
        }
        
        // Update upload button text
        this.uploadBtn.textContent = fileCount === 0 ? 'Upload Files' : 
            `Upload ${fileCount} File${fileCount === 1 ? '' : 's'}`;
    }
    
    async uploadFiles() {
        if (this.files.length === 0) return;
        
        this.uploadBtn.disabled = true;
        this.progressContainer.style.display = 'block';
        
        try {
            const formData = new FormData();
            this.files.forEach((fileObj, index) => {
                formData.append(`files[${index}]`, fileObj.file);
            });
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                alert('Files uploaded successfully!');
                this.clearAllFiles();
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            alert('Upload failed: ' + error.message);
        } finally {
            this.uploadBtn.disabled = false;
            this.progressContainer.style.display = 'none';
            this.updateProgress(0);
        }
    }
    
    updateProgress(percent) {
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = `${percent}%`;
    }
    
    truncateFileName(fileName, maxLength = 30) {
        if (fileName.length <= maxLength) return fileName;
        const extension = fileName.split('.').pop();
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';
        return truncatedName + '.' + extension;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Public method to get all files
    getFiles() {
        return this.files;
    }
}

// Initialize the file uploader
const fileUploader = new FileUploader();