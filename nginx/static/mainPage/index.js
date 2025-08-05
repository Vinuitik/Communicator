// Pagination state
let currentPage = 1;
let totalPages = 1;
let currentMode = 'allFriends'; // 'allFriends' or 'thisWeek'
const pageSize = 10;

// Helper: Get days difference between today and plannedSpeakingTime
function getDaysDiff(plannedDateStr) {
    if (!plannedDateStr) {
        console.warn('plannedDateStr is null or undefined:', plannedDateStr);
        return NaN;
    }
    const today = new Date();
    const plannedDate = new Date(plannedDateStr);
    
    // Check if plannedDate is valid
    if (isNaN(plannedDate.getTime())) {
        console.warn('Invalid date:', plannedDateStr);
        return NaN;
    }
    
    // Zero out time for accurate day diff
    today.setHours(0,0,0,0);
    plannedDate.setHours(0,0,0,0);
    // Negative if plannedDate is in the past (overdue)
    return Math.floor((plannedDate - today) / (1000 * 60 * 60 * 24));
}

// Helper: Get color from red to green based on daysDiff
function getGradientColor(daysDiff) {
    // Handle NaN or invalid values
    if (isNaN(daysDiff)) {
        return '#999'; // Gray color for missing data
    }
    
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

// Helper: Get intensity gradient color based on score
function getIntensityGradientColor(intensityScore) {
    // Handle NaN or invalid values
    if (isNaN(intensityScore)) {
        return '#999'; // Gray color for missing data
    }
    
    // Clamp intensity score between 0 and 10 for reasonable range
    const min = 0, max = 10;
    const clamped = Math.max(min, Math.min(max, intensityScore));
    // Map 0 to 0 (red), 5 to 0.5 (yellow), 10 to 1 (green)
    const percent = clamped / max;
    
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

// Helper: Calculate intensity score from exponential moving averages
function calculateIntensityScore(friend) {
    const frequency = friend.averageFrequency || 0;
    const duration = friend.averageDuration || 0;
    const excitement = friend.averageExcitement || 0;
    
    // Debug logging
    console.log('Friend data for intensity calculation:', {
        name: friend.name,
        frequency: frequency,
        duration: duration,
        excitement: excitement,
        plannedSpeakingTime: friend.plannedSpeakingTime
    });
    
    // Sum of the three exponential averages
    return frequency + duration + excitement;
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

async function viewRequest(endpoint, page = 1) {
    try {
        let response;
        let data;
        
        if (endpoint === 'allFriends') {
            // Use paginated endpoint for all friends
            response = await fetch(`/api/friend/friends/ui/page/${page - 1}/size/${pageSize}`);
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
            data = await response.json();
            
            // For paginated response, we need to get total count separately
            const countResponse = await fetch('/api/friend/friends/count');
            if (countResponse.ok) {
                const totalCount = await countResponse.json();
                totalPages = Math.ceil(totalCount / pageSize);
                updatePaginationInfo(data.length, totalCount, page);
            }
        } else {
            // For thisWeek, use the existing non-paginated endpoint
            response = await fetch(`/api/friend/${endpoint}`);
            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }
            data = await response.json();
            
            // For thisWeek, show all results on one page
            totalPages = 1;
            updatePaginationInfo(data.length, data.length, 1);
        }
        
        data.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`Fetched data from ${endpoint}:`, data);
        
        // Debug: Log the first friend to see the structure
        if (data && data.length > 0) {
            console.log('First friend structure:', data[0]);
        }

        // Handle displaying data dynamically here
        const tbody = document.querySelector('tbody');
        tbody.innerHTML = ''; // Clear existing rows
        
        data.forEach(friend => {
            const row = document.createElement('tr');
            row.setAttribute('data-id', friend.id); // Store the ID on the row element

            // Calculate days difference and color
            const daysDiff = getDaysDiff(friend.plannedSpeakingTime);
            const color = getGradientColor(daysDiff);
            const diffText = isNaN(daysDiff) ? 'No Date' : 
                           (daysDiff === 0 ? 'Today' : 
                           (daysDiff > 0 ? `+${daysDiff} days` : `${daysDiff} days`));

            // Calculate intensity score and its color
            const intensityScore = calculateIntensityScore(friend);
            const intensityColor = getIntensityGradientColor(intensityScore);
            const intensityText = isNaN(intensityScore) ? 'N/A' : intensityScore.toFixed(2);

            row.innerHTML = `
                <td>${friend.name}</td>
                <td style="font-weight:bold; color: ${color};">${diffText}</td>
                <td style="font-weight:bold; color: ${intensityColor};">${intensityText}</td>
                <td>${friend.dateOfBirth ? friend.dateOfBirth : ''}</td>
                <td class="actions-cell">
                    <div class="dropdown">
                        <button class="dropdown-button">⋮</button>
                        <div class="dropdown-content">
                            <a href="/api/friend/talked/${friend.id}" class="dropdown-item">Talked</a>
                            <a href="api/friend/profile/${friend.id}" class="dropdown-item">Profile</a>
                            <a href="api/friend/knowledge/${friend.id}" class="dropdown-item">Knowledge</a>
                            <a href="api/group/groups/${friend.id}" class="dropdown-item">Groups</a>
                            <a href="api/connections/${friend.id}" class="dropdown-item">Connections</a>
                            <a href="#" class="dropdown-item delete-button">Delete</a>
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
                        
                        // Refresh current page after deletion
                        await loadCurrentPage();
                    } catch (error) {
                        console.error('Error deleting friend:', error);
                    }
                });
            }
        });
        
        // Update pagination controls
        updatePaginationControls();
        
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
    }
}

async function fetchAllFriends() {
    currentMode = 'allFriends';
    currentPage = 1;
    await viewRequest('allFriends', currentPage);
}

async function fetchWeekFriends() {
    currentMode = 'thisWeek';
    currentPage = 1;
    await viewRequest('thisWeek', currentPage);
}

// Load current page based on current mode
async function loadCurrentPage() {
    await viewRequest(currentMode, currentPage);
}

// Update pagination info display
function updatePaginationInfo(itemsOnPage, totalItems, page) {
    const friendsInfo = document.getElementById('friendsInfo');
    const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);
    
    friendsInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} friends`;
}

// Update pagination controls
function updatePaginationControls() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInput = document.getElementById('pageInput');
    const totalPagesSpan = document.getElementById('totalPages');
    
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages || currentMode === 'thisWeek';
    
    pageInput.value = currentPage;
    pageInput.max = totalPages;
    totalPagesSpan.textContent = totalPages;
    
    // Hide pagination for thisWeek mode
    const paginationContainer = document.querySelector('.pagination-container');
    if (currentMode === 'thisWeek') {
        paginationContainer.style.display = 'block'; // Still show info
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        document.querySelector('.page-info').style.display = 'none';
    } else {
        paginationContainer.style.display = 'block';
        prevBtn.style.display = 'inline-block';
        nextBtn.style.display = 'inline-block';
        document.querySelector('.page-info').style.display = 'flex';
    }
}

// Go to specific page
async function goToPage(page) {
    if (page < 1 || page > totalPages || currentMode === 'thisWeek') return;
    
    currentPage = page;
    await loadCurrentPage();
}

// Initialize pagination event listeners
function initializePagination() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInput = document.getElementById('pageInput');
    
    prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
    
    pageInput.addEventListener('change', (e) => {
        const page = parseInt(e.target.value);
        goToPage(page);
    });
    
    pageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const page = parseInt(e.target.value);
            goToPage(page);
        }
    });
}

// Event listeners for buttons
document.getElementById('viewAllFriends').addEventListener('click', fetchAllFriends);
const weekViews = document.getElementsByClassName('viewWeek');
for (let i = 0; i < weekViews.length; i++) {
  weekViews[i].addEventListener('click', fetchWeekFriends);
}

// Initialize pagination and load default view
window.onload = () => {
    initializePagination();
    fetchAllFriends();
};

document.querySelectorAll('.samePage').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    // Your click handling code here
  });
});