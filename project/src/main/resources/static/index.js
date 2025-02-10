async function viewRequest(endpoint) {
    try {
        const response = await fetch(`http://localhost:8085/${endpoint}`);
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json(); // sort
        data.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`Fetched data from ${endpoint}:`, data);

        // Handle displaying data dynamically here
        const tbody = document.querySelector('tbody');
        tbody.innerHTML = ''; // Clear existing rows
        data.forEach(friend => {
            const row = document.createElement('tr');
            row.setAttribute('data-id', friend.id); // Store the ID on the row element
            row.innerHTML = `
                <td>${friend.name}</td>
                <td>${friend.plannedSpeakingTime}</td>
                <td>${friend.experience}</td>
                <td>${friend.dateOfBirth}</td>
                <td>
                    <button class="button delete-button">Delete</button>
                    <a href="talked/${friend.id}" class="button">Talked</a>
                    <a href="knowledge/${friend.id}" class="button">Knowledge</button>
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
        console.error(`Error fetching data from ${endpoint}:`, error);
    }
}

async function fetchAllFriends() {
    await viewRequest('allFriends');
}

async function fetchWeekFriends() {
    await viewRequest('thisWeek');
}

// Event listeners for buttons
document.getElementById('viewAllFriends').addEventListener('click', fetchAllFriends);
document.getElementById('viewWeek').addEventListener('click', fetchWeekFriends);

window.onload = fetchWeekFriends;