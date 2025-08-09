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
        console.log(`Fetching ${endpoint}, page ${page}`);
        let response;
        let data;
        
        // Show loading state
        const tbody = document.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading...</td></tr>';
        }
        
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
            } else {
                console.warn('Could not fetch total count, using current data length');
                totalPages = Math.max(1, Math.ceil(data.length / pageSize));
                updatePaginationInfo(data.length, data.length, page);
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
        
        // Clear loading state
        if (tbody) {
            tbody.innerHTML = '';
        }
        
        // Validate data
        if (!Array.isArray(data)) {
            throw new Error('Invalid data format received from server');
        }
        
        data.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`Fetched ${data.length} items from ${endpoint}`);
        
        // Debug: Log the first friend to see the structure
        if (data && data.length > 0) {
            console.log('First friend structure:', data[0]);
        }

        // Handle displaying data dynamically here
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No friends found.</td></tr>';
        } else {
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
                    <td>${friend.name || 'Unknown'}</td>
                    <td style="font-weight:bold; color: ${color};">${diffText}</td>
                    <td style="font-weight:bold; color: ${intensityColor};">${intensityText}</td>
                    <td>${friend.dateOfBirth ? friend.dateOfBirth : ''}</td>
                    <td class="actions-cell">
                        <div class="dropdown">
                            <button class="dropdown-button" type="button">⋮</button>
                            <div class="dropdown-content">
                                <a href="/api/friend/talked/${friend.id}" class="dropdown-item">Talked</a>
                                <a href="api/friend/profile/${friend.id}" class="dropdown-item">Profile</a>
                                <a href="api/friend/knowledge/${friend.id}" class="dropdown-item">Knowledge</a>
                                <a href="api/groups/${friend.id}" class="dropdown-item">Groups</a>
                                <a href="api/connections/${friend.id}" class="dropdown-item">Connections</a>
                                <a href="#" class="dropdown-item delete-button">Delete</a>
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);

                // Setup dropdown functionality
                const dropdownButton = row.querySelector('.dropdown-button');
                const dropdownContent = row.querySelector('.dropdown-content');

                if (dropdownButton && dropdownContent) {
                    // Toggle dropdown
                    dropdownButton.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        
                        // Close other open dropdowns
                        document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
                            if (dropdown !== dropdownContent) {
                                dropdown.classList.remove('show');
                            }
                        });
                        
                        dropdownContent.classList.toggle('show');
                    });
                }

                // Handle delete action
                const deleteButton = row.querySelector('.delete-button');
                if (deleteButton) {
                    deleteButton.addEventListener('click', async (event) => {
                        event.preventDefault();
                        const friendId = row.getAttribute('data-id');
                        
                        if (!confirm(`Are you sure you want to delete ${friend.name || 'this friend'}?`)) {
                            return;
                        }
                        
                        try {
                            const deleteResponse = await fetch(`/api/friend/deleteFriend/${friendId}`, {
                                method: 'DELETE'
                            });
                            if (!deleteResponse.ok) {
                                throw new Error(`Error: ${deleteResponse.statusText}`);
                            }
                            
                            console.log(`Friend with ID ${friendId} deleted.`);
                            
                            // Refresh current page after deletion
                            await loadCurrentPage();
                        } catch (error) {
                            console.error('Error deleting friend:', error);
                            alert('Failed to delete friend. Please try again.');
                        }
                    });
                }
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!event.target.matches('.dropdown-button')) {
                document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
                    dropdown.classList.remove('show');
                });
            }
        });
        
        // Update pagination controls
        updatePaginationControls();
        
    } catch (error) {
        console.error(`Error fetching data from ${endpoint}:`, error);
        
        // Show error state
        const tbody = document.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #e74c3c;">
                Error loading friends: ${error.message}. Please try again.
            </td></tr>`;
        }
        
        // Reset pagination on error
        totalPages = 1;
        currentPage = 1;
        updatePaginationControls();
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
    const pageInfo = document.querySelector('.page-info');
    
    if (!prevBtn || !nextBtn || !pageInput || !totalPagesSpan) {
        console.warn('Pagination elements not found');
        return;
    }
    
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages || currentMode === 'thisWeek';
    
    pageInput.value = currentPage;
    pageInput.max = totalPages;
    totalPagesSpan.textContent = totalPages;
    
    // Handle pagination visibility for different modes
    const paginationContainer = document.querySelector('.pagination-container');
    if (paginationContainer) {
        if (currentMode === 'thisWeek') {
            paginationContainer.style.display = 'flex'; // Keep container visible
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            if (pageInfo) {
                pageInfo.style.display = 'none';
            }
        } else {
            paginationContainer.style.display = 'flex';
            prevBtn.style.display = 'inline-block';
            nextBtn.style.display = 'inline-block';
            if (pageInfo) {
                pageInfo.style.display = 'flex';
            }
        }
    }
    
    console.log(`Pagination updated: page ${currentPage} of ${totalPages}, mode: ${currentMode}`);
}

// Go to specific page
async function goToPage(page) {
    if (page < 1 || page > totalPages || currentMode === 'thisWeek') {
        console.log(`Invalid page request: ${page} (valid range: 1-${totalPages}, mode: ${currentMode})`);
        return;
    }
    
    console.log(`Navigating to page ${page}`);
    currentPage = page;
    await loadCurrentPage();
}

// Initialize pagination event listeners
function initializePagination() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInput = document.getElementById('pageInput');
    
    if (!prevBtn || !nextBtn || !pageInput) {
        console.error('Pagination elements not found during initialization');
        return;
    }
    
    prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    });
    
    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    });
    
    pageInput.addEventListener('change', (e) => {
        const page = parseInt(e.target.value);
        if (page >= 1 && page <= totalPages) {
            goToPage(page);
        } else {
            // Reset to current page if invalid
            e.target.value = currentPage;
        }
    });
    
    pageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const page = parseInt(e.target.value);
            if (page >= 1 && page <= totalPages) {
                goToPage(page);
            } else {
                // Reset to current page if invalid
                e.target.value = currentPage;
            }
        }
    });
    
    console.log('Pagination initialized successfully');
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