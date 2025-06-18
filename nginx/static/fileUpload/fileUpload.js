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

// File collection management
class FileCollection {
    constructor() {
        this.files = [];
        this.listeners = [];
    }
    
    addListener(callback) {
        this.listeners.push(callback);
    }
    
    notifyListeners() {
        this.listeners.forEach(callback => callback(this.files));
    }
    
    addFile(file) {
        const fileObj = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            file: file,
            name: file.name,
            size: file.size,
            type: file.type,
            category: FileUtilities.getFileCategory(file.type),
            lastModified: new Date(file.lastModified)
        };
        
        this.files.push(fileObj);
        this.notifyListeners();
        return fileObj;
    }
    
    removeFile(fileId) {
        this.files = this.files.filter(file => file.id !== fileId);
        this.notifyListeners();
    }
    
    clearAll() {
        this.files = [];
        this.notifyListeners();
    }
    
    getFile(fileId) {
        return this.files.find(f => f.id === fileId);
    }
    
    getFiles() {
        return this.files;
    }
    
    getCount() {
        return this.files.length;
    }
}

// Drag and drop handling
class DragDropHandler {
    constructor(uploadArea, onFilesDropped) {
        this.uploadArea = uploadArea;
        this.onFilesDropped = onFilesDropped;
        this.init();
    }
    
    init() {
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
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
        this.onFilesDropped(files);
    }
}

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

// Preview modal management
class PreviewManager {
    constructor(modal, container, fileName) {
        this.modal = modal;
        this.container = container;
        this.fileName = fileName;
        this.currentFile = null;
        this.init();
    }
    
    init() {
        const closeModal = document.getElementById('closeModal');
        closeModal.addEventListener('click', () => this.close());
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'block') {
                this.close();
            }
        });
    }
    
    show(fileObj) {
        this.currentFile = fileObj;
        
        // Update modal title and file info
        this.fileName.textContent = fileObj.name;
        document.getElementById('modalFileName').textContent = fileObj.name;
        document.getElementById('modalFileSize').textContent = FileUtilities.formatFileSize(fileObj.size);
        document.getElementById('modalFileType').textContent = fileObj.type || 'Unknown';
        document.getElementById('modalFileDate').textContent = fileObj.lastModified.toLocaleString();
        
        // Generate preview content
        this.generatePreviewContent(fileObj);
        
        // Show modal
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
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
        
        this.container.innerHTML = previewHTML;
    }
    
    close() {
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.currentFile = null;
        
        // Clean up object URLs to prevent memory leaks
        const mediaElements = this.container.querySelectorAll('img, video, audio, iframe');
        mediaElements.forEach(el => {
            if (el.src && el.src.startsWith('blob:')) {
                URL.revokeObjectURL(el.src);
            }
        });
    }
    
    getCurrentFile() {
        return this.currentFile;
    }
}

// Progress tracking
class ProgressTracker {
    constructor(container, fill, text) {
        this.container = container;
        this.fill = fill;
        this.text = text;
    }
    
    show() {
        this.container.style.display = 'block';
    }
    
    hide() {
        this.container.style.display = 'none';
    }
    
    update(percent) {
        this.fill.style.width = `${percent}%`;
        this.text.textContent = `${percent}%`;
    }
}

// Upload controller
class UploadController {
    constructor(progressTracker) {
        this.progressTracker = progressTracker;
    }
    
    async upload(files) {
        this.progressTracker.show();
        
        try {
            const formData = new FormData();
            files.forEach((fileObj, index) => {
                formData.append(`files[${index}]`, fileObj.file);
            });
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                alert('Files uploaded successfully!');
                return true;
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            alert('Upload failed: ' + error.message);
            return false;
        } finally {
            this.progressTracker.hide();
            this.progressTracker.update(0);
        }
    }
}

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

// Main FileUploader class - now acts as a coordinator
class FileUploader {
    constructor() {
        this.initializeComponents();
        this.setupEventListeners();
    }
    
    initializeComponents() {
        // Initialize DOM elements
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
        this.previewModal = document.getElementById('previewModal');
        this.previewContainer = document.getElementById('previewContainer');
        this.previewFileName = document.getElementById('previewFileName');
        
        // Initialize components
        this.fileValidator = new FileValidator();
        this.fileCollection = new FileCollection();
        this.dragDropHandler = new DragDropHandler(this.uploadArea, (files) => this.addFiles(files));
        this.fileListRenderer = new FileListRenderer(
            this.filesContainer,
            (fileId) => this.showPreview(fileId),
            (fileId) => this.removeFile(fileId)
        );
        this.previewManager = new PreviewManager(this.previewModal, this.previewContainer, this.previewFileName);
        this.progressTracker = new ProgressTracker(this.progressContainer, this.progressFill, this.progressText);
        this.uploadController = new UploadController(this.progressTracker);
        this.uiStateManager = new UIStateManager(this.fileCount, this.emptyState, this.uploadBtn);
        
        // Listen to file collection changes
        this.fileCollection.addListener((files) => {
            this.fileListRenderer.render(files);
            this.uiStateManager.update(files);
        });
        
        // Initial UI update
        this.uiStateManager.update([]);
    }
    
    setupEventListeners() {
        // File input change event
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Button events
        this.uploadBtn.addEventListener('click', () => this.uploadFiles());
        this.clearBtn.addEventListener('click', () => this.clearAllFiles());
    }
    
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.addFiles(files);
        event.target.value = ''; // Reset input
    }
    
    addFiles(files) {
        files.forEach(file => {
            if (this.fileValidator.validateFile(file, this.fileCollection.getFiles())) {
                this.fileCollection.addFile(file);
            }
        });
    }
    
    removeFile(fileId) {
        this.fileCollection.removeFile(fileId);
    }
    
    clearAllFiles() {
        this.fileCollection.clearAll();
        this.previewManager.close();
    }
    
    showPreview(fileId) {
        const fileObj = this.fileCollection.getFile(fileId);
        if (fileObj) {
            this.previewManager.show(fileObj);
        }
    }
    
    async uploadFiles() {
        const files = this.fileCollection.getFiles();
        if (files.length === 0) return;
        
        this.uploadBtn.disabled = true;
        const success = await this.uploadController.upload(files);
        
        if (success) {
            this.clearAllFiles();
        }
        
        this.uploadBtn.disabled = false;
    }
    
    // Public method to get all files
    getFiles() {
        return this.fileCollection.getFiles();
    }
}

// Initialize the file uploader
const fileUploader = new FileUploader();