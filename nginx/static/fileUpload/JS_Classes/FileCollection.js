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