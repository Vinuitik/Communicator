// Upload controller
class UploadController {
    constructor(progressTracker) {
        this.progressTracker = progressTracker;
        this.friendId = 205;
    }

    // Method to change friendId if needed
    setFriendId(friendId) {
        this.friendId = friendId;
    }
    
    async upload(files) {
        this.progressTracker.show();
        
        try {
            const formData = new FormData();
            
            // Change from files[index] to just 'files' to match backend
            files.forEach((fileObj) => {
                formData.append('files', fileObj.file);
            });
            
            // Add friendId parameter
            formData.append('friendId', this.friendId);
            
            const response = await fetch('/api/friend/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                alert('Files uploaded successfully!');
                return true;
            } else {
                const errorData = await response.json();
                throw new Error(`Upload failed (${response.status}): ${errorData.error || 'Unknown error'}`);
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