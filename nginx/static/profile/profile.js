mediaUploadButton = document.getElementById('mediaUploadButton');
mediaUploadButton.addEventListener('click', () => 
    {window.location.href = '/fileUpload/' +
         window.location.pathname.split('/').pop(); }); // Redirect to file upload page