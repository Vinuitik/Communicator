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