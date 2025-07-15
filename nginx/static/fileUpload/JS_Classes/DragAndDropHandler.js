class DragDropHandler {
    constructor(uploadArea, onFilesDropped) {
        this.uploadArea = uploadArea;
        this.onFilesDropped = onFilesDropped;
        this.dragCounter = 0; // Firefox drag counter fix
        this.init();
    }
    
    init() {
        // Firefox needs all these events to be explicitly handled
        this.uploadArea.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Additional Firefox compatibility - handle on document level
        document.addEventListener('dragenter', (e) => this.handleDocumentDragEnter(e));
        document.addEventListener('dragleave', (e) => this.handleDocumentDragLeave(e));
        document.addEventListener('dragover', (e) => this.handleDocumentDragOver(e));
        document.addEventListener('drop', (e) => this.handleDocumentDrop(e));
    }
    
    handleDragEnter(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dragCounter++;
        
        // Only add class if we have files being dragged
        if (this.hasFiles(event)) {
            this.uploadArea.classList.add('dragover');
        }
    }
    
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Firefox requires dataTransfer.dropEffect to be set
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        
        // Ensure dragover class is maintained
        if (this.hasFiles(event)) {
            this.uploadArea.classList.add('dragover');
        }
    }
    
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dragCounter--;
        
        // Firefox fix: only remove dragover when counter reaches 0
        if (this.dragCounter <= 0) {
            this.dragCounter = 0;
            this.uploadArea.classList.remove('dragover');
        }
    }
    
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dragCounter = 0;
        this.uploadArea.classList.remove('dragover');
        
        console.log('Drop event triggered', event); // Debug log
        
        // Firefox and Chrome compatibility
        let files = [];
        
        if (event.dataTransfer && event.dataTransfer.files) {
            files = Array.from(event.dataTransfer.files);
            console.log('Files found:', files.length); // Debug log
        }
        
        if (files.length > 0) {
            console.log('Calling onFilesDropped with files:', files); // Debug log
            this.onFilesDropped(files);
        } else {
            console.log('No files found in drop event'); // Debug log
        }
    }
    
    // Document-level handlers to prevent default browser behavior
    handleDocumentDragEnter(event) {
        // Prevent default only if not our upload area
        if (!this.uploadArea.contains(event.target)) {
            event.preventDefault();
        }
    }
    
    handleDocumentDragOver(event) {
        // Prevent default browser behavior (opening files)
        event.preventDefault();
    }
    
    handleDocumentDragLeave(event) {
        // Reset counter if leaving document completely
        if (!event.relatedTarget) {
            this.dragCounter = 0;
            this.uploadArea.classList.remove('dragover');
        }
    }
    
    handleDocumentDrop(event) {
        // Prevent default browser behavior if not dropping on our area
        if (!this.uploadArea.contains(event.target)) {
            event.preventDefault();
        }
    }
    
    // Helper method to check if drag event contains files
    hasFiles(event) {
        if (!event.dataTransfer) return false;
        
        // Firefox compatibility check
        if (event.dataTransfer.types) {
            return event.dataTransfer.types.includes('Files') || 
                   event.dataTransfer.types.includes('application/x-moz-file');
        }
        
        return false;
    }
}