# File Upload System with Preview

A comprehensive drag-and-drop file upload system with real-time preview functionality for images, videos, audio files, PDFs, and documents.

## 🚀 Features

- **Drag & Drop Upload**: Intuitive drag-and-drop interface
- **File Preview**: Click any file to see a detailed preview
- **Multiple File Types**: Support for images, videos, audio, PDFs, and documents
- **File Validation**: Size limits, type checking, and duplicate prevention
- **Progress Tracking**: Real-time upload progress indication
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Memory Management**: Automatic cleanup to prevent memory leaks

## 📁 Project Structure

```
fileUpload/
├── fileUpload.html    # Main HTML structure
├── fileUpload.css     # Styling and animations
└── fileUpload.js      # Core functionality and logic
```

## 🎯 How It Works

### 1. **File Selection Process**

#### Drag & Drop
```javascript
handleDragOver(event) {
    event.preventDefault();
    this.uploadArea.classList.add('dragover');
}

handleDrop(event) {
    event.preventDefault();
    this.uploadArea.classList.remove('dragover');
    const files = Array.from(event.dataTransfer.files);
    this.addFiles(files);
}
```
- User drags files over the upload area
- Visual feedback shows the drop zone is active
- Files are automatically processed when dropped

#### Browse Button
```javascript
// Triggered when user clicks "Browse Files"
this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
```
- Traditional file picker opens
- Multiple file selection enabled
- Same processing pipeline as drag & drop

### 2. **File Validation System**

The system implements comprehensive validation:

```javascript
validateFile(file) {
    // Check file count limit (max 10 files)
    if (this.files.length >= this.maxFiles) {
        alert(`Maximum ${this.maxFiles} files allowed`);
        return false;
    }
    
    // Check file size (max 50MB)
    if (file.size > this.maxFileSize) {
        alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
        return false;
    }
    
    // Check for duplicates
    const exists = this.files.some(f => f.name === file.name && f.size === file.size);
    if (exists) {
        alert(`File "${file.name}" is already selected.`);
        return false;
    }
    
    return true;
}
```

**Validation Rules:**
- ✅ Maximum 10 files per upload
- ✅ 50MB size limit per file
- ✅ Duplicate file prevention
- ✅ Supported file types only

### 3. **File Categorization**

Files are automatically categorized for appropriate handling:

```javascript
getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'default';
}
```

**Categories:**
- 🖼️ **Images**: JPG, PNG, GIF, WebP
- 🎥 **Videos**: MP4, MOV, AVI, WebM
- 🎵 **Audio**: MP3, WAV, OGG
- 📄 **PDFs**: PDF documents
- 📁 **Default**: All other file types

### 4. **Dynamic File List Generation**

Each selected file creates a visual representation:

```javascript
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
                <div class="file-name">${this.truncateFileName(fileObj.name)}</div>
                <div class="file-size">${this.formatFileSize(fileObj.size)}</div>
            </div>
        </div>
        <button class="remove-file" onclick="...">×</button>
    `;
    
    // Add click event for preview
    fileItem.addEventListener('click', (e) => {
        if (!e.target.classList.contains('remove-file')) {
            this.showPreview(fileObj.id);
        }
    });
}
```

**File Item Features:**
- 🎯 Click to preview
- 🗑️ Individual remove button
- 📊 File size display
- 🏷️ Type-specific icons
- ✂️ Smart filename truncation

### 5. **Preview System Architecture**

The preview system dynamically generates content based on file type:

#### Image Preview
```javascript
case 'image':
    const imageUrl = URL.createObjectURL(fileObj.file);
    previewHTML = `<img src="${imageUrl}" alt="${fileObj.name}" class="preview-image">`;
    break;
```

#### Video Preview
```javascript
case 'video':
    const videoUrl = URL.createObjectURL(fileObj.file);
    previewHTML = `
        <video controls class="preview-video">
            <source src="${videoUrl}" type="${fileObj.type}">
            Your browser does not support the video tag.
        </video>
    `;
    break;
```

#### PDF Preview
```javascript
case 'pdf':
    const pdfUrl = URL.createObjectURL(fileObj.file);
    previewHTML = `
        <iframe src="${pdfUrl}" style="width: 100%; height: 400px;"></iframe>
    `;
    break;
```

### 6. **Modal Management**

The preview modal provides a rich viewing experience:

```javascript
showPreview(fileId) {
    const fileObj = this.files.find(f => f.id === fileId);
    this.currentPreviewFile = fileObj;
    
    // Update modal content
    this.previewFileName.textContent = fileObj.name;
    this.generatePreviewContent(fileObj);
    
    // Show modal with animations
    this.previewModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}
```

**Modal Features:**
- 🖼️ Full-screen preview
- ℹ️ Detailed file information
- 🗑️ Delete from preview
- ⌨️ Keyboard shortcuts (ESC to close)
- 🎨 Smooth animations

### 7. **Memory Management**

Critical for preventing memory leaks with large files:

```javascript
closePreview() {
    this.previewModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Clean up object URLs to prevent memory leaks
    const mediaElements = this.previewContainer.querySelectorAll('img, video, audio, iframe');
    mediaElements.forEach(el => {
        if (el.src && el.src.startsWith('blob:')) {
            URL.revokeObjectURL(el.src);
        }
    });
}
```

### 8. **Upload Process**

The upload system uses modern FormData API:

```javascript
async uploadFiles() {
    const formData = new FormData();
    this.files.forEach((fileObj, index) => {
        formData.append(`files[${index}]`, fileObj.file);
    });
    
    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    
    if (response.ok) {
        alert('Files uploaded successfully!');
        this.clearAllFiles();
    }
}
```

## 🎨 CSS Architecture

### Component-Based Styling

The CSS is organized into logical components:

```css
/* Upload Area */
.upload-area {
    border: 2px dashed #6c5ce7;
    transition: all 0.3s ease;
    cursor: pointer;
}

.upload-area:hover,
.upload-area.dragover {
    border-color: #5f4dd0;
    background-color: #f0f0ff;
    transform: translateY(-2px);
}
```

### Responsive Design

```css
.modal-content {
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
}

@media (max-width: 768px) {
    .upload-actions {
        flex-direction: column;
    }
}
```

### Animations

```css
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideIn {
    from { 
        opacity: 0;
        transform: translateY(-50px);
    }
    to { 
        opacity: 1;
        transform: translateY(0);
    }
}
```

## 🔧 Configuration Options

### File Limits
```javascript
constructor() {
    this.maxFiles = 10;                    // Maximum files per upload
    this.maxFileSize = 50 * 1024 * 1024;   // 50MB per file
}
```

### Supported File Types
```html
<input type="file" accept="image/*,video/*,.pdf,.doc,.docx" multiple>
```

### API Endpoint
```javascript
const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
});
```

## 🚀 Usage

### Basic Implementation

1. **Include the files:**
```html
<link rel="stylesheet" href="/fileUpload/fileUpload.css">
<script src="/fileUpload/fileUpload.js"></script>
```

2. **Initialize:**
```javascript
const fileUploader = new FileUploader();
```

### Custom Configuration

```javascript
class CustomFileUploader extends FileUploader {
    constructor() {
        super();
        this.maxFiles = 20;           // Increase file limit
        this.maxFileSize = 100 * 1024 * 1024; // 100MB limit
    }
}
```

## 🛠️ API Integration

### Backend Requirements

Your server should handle:

```javascript
// Express.js example
app.post('/api/upload', upload.array('files'), (req, res) => {
    // Process uploaded files
    const files = req.files;
    
    // Save files and return response
    res.json({ 
        success: true, 
        fileCount: files.length,
        files: files.map(f => ({ name: f.originalname, size: f.size }))
    });
});
```

## 🎯 Key Benefits

### User Experience
- **Intuitive Interface**: Drag & drop feels natural
- **Instant Feedback**: Real-time file list updates
- **Preview Before Upload**: Verify correct files selected
- **Progress Indication**: Users know upload status

### Developer Experience
- **Modular Design**: Easy to customize and extend
- **Clean Code**: Well-documented and maintainable
- **Memory Efficient**: Proper cleanup prevents leaks
- **Error Handling**: Comprehensive validation and feedback

### Performance
- **Client-Side Validation**: Reduces server load
- **Efficient File Handling**: Minimal memory footprint
- **Lazy Loading**: Previews generated on-demand
- **Optimized Animations**: Smooth 60fps transitions

## 🔮 Future Enhancements

- **Image Compression**: Automatic resize before upload
- **Chunk Upload**: Resume interrupted uploads
- **Cloud Integration**: Direct upload to AWS S3/Google Cloud
- **Batch Processing**: Multiple upload queues
- **File Editing**: Basic image editing tools

---

This file upload system demonstrates modern web development practices with clean architecture, user-focused design, and robust functionality. The modular approach makes it easy