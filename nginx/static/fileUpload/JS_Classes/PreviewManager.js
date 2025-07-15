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
        if (closeModal) {
            closeModal.addEventListener('click', () => this.close());
        }

        // Use event delegation for better reliability across browsers
        this.modal.addEventListener('click', (e) => {
            // Close on X button or close button click
            if (e.target.id === 'closeModal' || 
                e.target.id === 'closeButton' || 
                e.target.classList.contains('modal-close') ||
                e.target === this.modal) {
                this.close();
            }
        });
        
        // Keyboard event with better browser compatibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalVisible()) {
                this.close();
            }
        });
    }
    
    isModalVisible() {
        return this.modal.style.display === 'block' || 
               this.modal.style.display === '' && 
               window.getComputedStyle(this.modal).display === 'block';
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
        
        // Show modal with better cross-browser support
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Force reflow for better browser compatibility
        this.modal.offsetHeight;
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