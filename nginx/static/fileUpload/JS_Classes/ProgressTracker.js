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