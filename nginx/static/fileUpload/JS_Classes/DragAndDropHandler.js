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