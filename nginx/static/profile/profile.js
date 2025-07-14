mediaUploadButton = document.getElementById('mediaUploadButton');
mediaUploadButton.addEventListener('click', () => 
    {window.location.href = '/fileUpload/' +
         window.location.pathname.split('/').pop(); }); // Redirect to file upload page

function viewMedia(fileName, type) {
    const friendId = window.location.pathname.split('/').pop();;
    const url = `/api/fileRepository/file/${friendId}/${fileName}`;

    if (type === 'video') {
        // Open in a modal or new window for video
        window.open(url, '_blank');
    } else {
        // Open image in modal or new window
        window.open(url, '_blank');
    }
}

function viewResource(fileName) {
    const friendId = window.location.pathname.split('/').pop();
    const url = `/api/fileRepository/file/${friendId}/${fileName}`;

    // Open resource (PDF, document, etc.) in new tab
    window.open(url, '_blank');
}