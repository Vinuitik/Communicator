document.getElementById('friendForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent default form submission

    // Get form data
    const name = document.getElementById('name').value.trim();
    const lastSpoken = formatDate(document.getElementById('lastSpoken').value);
    const experience = document.getElementById('experience').value;
    const dobField = document.getElementById('dob').value;
    const dob = dobField ? formatDate(dobField) : null; // Set to null if empty

    const friendData = {
        name: name,
        lastTimeSpoken: lastSpoken,
        experience: experience,
        dateOfBirth: dob, // Pass null if dob is not provided
    };

    // Log for debugging (replace with actual backend call)
    console.log('Form data ready to send:', friendData);

    // Example of sending data to backend using fetch
    fetch('/addFriend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(friendData)
    })
    .then(response => {
        if (response.ok) {
            return response.text(); // Read response body as plain text
        } else {
            throw new Error('Failed to add friend.'); // Trigger catch block for non-2xx status
        }
    })
    .then(data => {
        console.log('Success:', data);
        alert(data); // Alert the server response message
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to add friend: ' + error.message); // Include specific error message
    });
});

// Format date to 'YYYY-MM-DD'
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}