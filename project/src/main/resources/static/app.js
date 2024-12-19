// Function to fetch and display all friends
async function fetchAllFriends() {
    try {
        const response = await fetch('http://localhost:8085/allFriends');
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Fetched friends:', data);

        // Handle displaying data dynamically here
        const tbody = document.querySelector('tbody');
        tbody.innerHTML = ''; // Clear existing rows
        data.forEach(friend => {
            const row = document.createElement('tr');
            row.setAttribute('data-id', friend.id); // Store the ID on the row element
            row.innerHTML = `
                <td>${friend.name}</td>
                <td>${friend.lastTimeSpoken}</td>
                <td>${friend.experience}</td>
                <td>${friend.dateOfBirth}</td>
                <td>
                    <button class="button delete-button">Delete</button>
                    <button class="button">Talked</button>
                    <button class="button">Knowledge</button>
                </td>
            `;
            tbody.appendChild(row);

            // Ensure delete button exists before attaching event listener
            const deleteButton = row.querySelector('.delete-button');
            if (deleteButton) {
                deleteButton.addEventListener('click', async (event) => {
                    const friendId = row.getAttribute('data-id'); // Get the ID from the row's data-id
                    try {
                        const deleteResponse = await fetch(`http://localhost:8085/deleteFriend/${friendId}`, {
                            method: 'DELETE'
                        });
                        if (!deleteResponse.ok) {
                            throw new Error(`Error: ${deleteResponse.statusText}`);
                        }
                        // Remove the row from the table after successful deletion
                        row.remove();
                        console.log(`Friend with ID ${friendId} deleted.`);
                    } catch (error) {
                        console.error('Error deleting friend:', error);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error fetching friends:', error);
    }
}



async function fetchWeekFriends() {
    try {
        const response = await fetch('http://localhost:8085/thisWeek');
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('Fetched friends:', data);

        // Handle displaying data dynamically here
        const tbody = document.querySelector('tbody');
        tbody.innerHTML = ''; // Clear existing rows
        data.forEach(friend => {
            const row = document.createElement('tr');
            row.setAttribute('data-id', friend.id); // Store the ID on the row element
            row.innerHTML = `
                <td>${friend.name}</td>
                <td>${friend.lastTimeSpoken}</td>
                <td>${friend.experience}</td>
                <td>${friend.dateOfBirth}</td>
                <td>
                    <button class="button delete-button">Delete</button>
                    <button class="button">Talked</button>
                    <button class="button">Knowledge</button>
                </td>
            `;
            tbody.appendChild(row);

            // Ensure delete button exists before attaching event listener
            const deleteButton = row.querySelector('.delete-button');
            if (deleteButton) {
                deleteButton.addEventListener('click', async (event) => {
                    const friendId = row.getAttribute('data-id'); // Get the ID from the row's data-id
                    try {
                        const deleteResponse = await fetch(`http://localhost:8085/deleteFriend/${friendId}`, {
                            method: 'DELETE'
                        });
                        if (!deleteResponse.ok) {
                            throw new Error(`Error: ${deleteResponse.statusText}`);
                        }
                        // Remove the row from the table after successful deletion
                        row.remove();
                        console.log(`Friend with ID ${friendId} deleted.`);
                    } catch (error) {
                        console.error('Error deleting friend:', error);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error fetching friends:', error);
    }
}

// Event listeners for buttons
document.getElementById('viewAllFriends').addEventListener('click', fetchAllFriends);

document.getElementById('viewWeek').addEventListener('click', fetchWeekFriends);

document.getElementById('viewStats').addEventListener('click', () => {
    alert('View Stats button clicked!');
});

// Show the Add Friend Form
document.getElementById('addFriend').addEventListener('click', () => {
    document.getElementById('addFriendForm').classList.remove('hidden');
});

// Hide the Add Friend Form
document.getElementById('cancelForm').addEventListener('click', () => {
    document.getElementById('addFriendForm').classList.add('hidden');
});

document.getElementById('friendForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent default form submission

    // Get form data
    const name = document.getElementById('name').value.trim();
    const lastSpoken = formatDate(document.getElementById('lastSpoken').value);
    const experience = document.getElementById('experience').value;
    const dob = formatDate(document.getElementById('dob').value);

    // Prepare data to send to backend
    const friendData = {
        name: name,
        lastTimeSpoken: lastSpoken,
        experience: experience,
        dateOfBirth: dob
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
