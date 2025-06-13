// Helper: Get days difference between today and plannedSpeakingTime
function getDaysDiff(plannedDateStr) {
    const today = new Date();
    const plannedDate = new Date(plannedDateStr);
    // Zero out time for accurate day diff
    today.setHours(0,0,0,0);
    plannedDate.setHours(0,0,0,0);
    // Negative if plannedDate is in the past (overdue)
    return Math.floor((plannedDate - today) / (1000 * 60 * 60 * 24));
}

// Helper: Get color from red to green based on daysDiff
function getGradientColor(daysDiff) {
    // Clamp daysDiff between -7 (very early) and +7 (very late)
    const min = -7, max = 7;
    const clamped = Math.max(min, Math.min(max, daysDiff));
    // Map -7 to 0 (red), 0 to 0.5 (yellow), 7 to 1 (green)
    const percent = (clamped - min) / (max - min);
    // Interpolate between red (#c0392b), yellow (#ffe21f), green (#2ecc40)
    if (percent < 0.5) {
        // Red to Yellow
        const ratio = percent / 0.5;
        return `rgb(${192 + (255-192)*ratio}, ${57 + (226-57)*ratio}, ${43 + (31-43)*ratio})`;
    } else {
        // Yellow to Green
        const ratio = (percent - 0.5) / 0.5;
        return `rgb(${255 + (46-255)*ratio}, ${226 + (204-226)*ratio}, ${31 + (64-31)*ratio})`;
    }
}

async function viewRequest(endpoint) {
    try {
        const response = await fetch(`/api/friend/${endpoint}`);
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

            // Calculate days difference and color
            const daysDiff = getDaysDiff(friend.plannedSpeakingTime);
            //daysDiff *= -1 Invert to match the original logic (overdue is positive)
            const color = getGradientColor(daysDiff);
            const diffText = daysDiff === 0 ? 'Today' : (daysDiff > 0 ? `+${daysDiff} days` : `${daysDiff} days`);

            row.innerHTML = `
                <td>${friend.name}</td>
                <td style="font-weight:bold; color: ${color};">${diffText}</td>
                <td>${friend.experience}</td>
                <td>${friend.dateOfBirth}</td>
                <td class="actions-cell">
                    <div class="dropdown">
                        <button class="dropdown-button">⋮</button>
                        <div class="dropdown-content">
                            <a href="#" class="dropdown-item delete-button">Delete</a>
                            <a href="/api/friend/talked/${friend.id}" class="dropdown-item">Talked</a>
                            <a href="api/friend/profile/${friend.id}" class="dropdown-item">Profile</a>
                            <a href="api/friend/knowledge/${friend.id}" class="dropdown-item">Knowledge</a>
                            <a href="api/group/groups/${friend.id}" class="dropdown-item">Groups</a>
                            <a href="api/connections/${friend.id}" class="dropdown-item">Connections</a>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(row);

            const dropdownButton = row.querySelector('.dropdown-button');
            const dropdownContent = row.querySelector('.dropdown-content');

            // Toggle dropdown
            dropdownButton.addEventListener('click', (event) => {
                event.stopPropagation();
                dropdownContent.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (event) => {
                if (!event.target.matches('.dropdown-button')) {
                    const dropdowns = document.getElementsByClassName('dropdown-content');
                    Array.from(dropdowns).forEach(dropdown => {
                        if (dropdown.classList.contains('show')) {
                            dropdown.classList.remove('show');
                        }
                    });
                }
            });

            // Handle delete action
            const deleteButton = row.querySelector('.delete-button');
            if (deleteButton) {
                deleteButton.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const friendId = row.getAttribute('data-id');
                    try {
                        const deleteResponse = await fetch(`/api/friend/deleteFriend/${friendId}`, {
                            method: 'DELETE'
                        });
                        if (!deleteResponse.ok) {
                            throw new Error(`Error: ${deleteResponse.statusText}`);
                        }
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
const weekViews = document.getElementsByClassName('viewWeek');
for (let i = 0; i < weekViews.length; i++) {
  weekViews[i].addEventListener('click', fetchWeekFriends);
}

window.onload = fetchAllFriends;

document.querySelectorAll('.samePage').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    // Your click handling code here
  });
});