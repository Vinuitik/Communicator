import { collectKnowledgeData } from '../facts/facts.js';


document.getElementById('friendForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent default form submission

    // Get the submit button and disable it
    const submitButton = document.querySelector('#friendForm button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Adding Friend...'; // Optional: Change button text
    }

    // Get today's date in the correct format
    const today = formatDate(new Date());

    // Get form data
    const name = document.getElementById('name').value.trim();
    const lastSpoken = formatDate(document.getElementById('lastSpoken').value);
    const experience = document.getElementById('experience').value;
    const dobField = document.getElementById('dob').value;
    const dob = dobField ? formatDate(dobField) : null; // Set to null if empty
    const hours = parseFloat(document.getElementById('hours').value); // Ensure hours is a floating-point number

    // Create analytics object
    const friendData = {
        name: name,
        plannedSpeakingTime: today,
        experience: experience,
        dateOfBirth: dob
    };
    
    const analyticsData = [{
        date: lastSpoken,
        experience: experience,
        hours: hours
    }];
    
    const requestData = {
        ...friendData,
        analytics: analyticsData,
        knowledge: collectKnowledgeData()
    };

    // Log for debugging (replace with actual backend call)
    console.log('Form data ready to send:', requestData);

    // Example of sending data to backend using fetch
    fetch('/api/friend/addFriend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (response.ok) {
            return response.text(); // Read response body as plain text
        } else {
            throw new Error('Failed to add friend.'); // Trigger catch block for non-2xx status
        }
    })
    .then(data => {
        const knowledgeTableBody = document.querySelector('#knowledgeTable tbody');
        if (knowledgeTableBody) {
            knowledgeTableBody.innerHTML = ''; // Clears all rows
        }
        window.location.href = "/";
    })
    .catch(error => {
        console.error('Error:', error);
        //alert('Failed to add friend: ' + error.message); // Include specific error message
    })
    .finally(() => {
        // Re-enable the button regardless of success or failure
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Friend'; // Reset button text
        }
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
