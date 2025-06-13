document.addEventListener('DOMContentLoaded', () => {
    // Load friends for this week
    loadWeeklyCalendar();
});

async function loadWeeklyCalendar() {
    try {
        // Fetch friends data from API
        const response = await fetch('/api/friend/thisWeek');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const friends = await response.json();
        
        // Generate calendar for current week
        renderCalendar(friends);
    } catch (error) {
        console.error('Error fetching friends data:', error);
        showErrorMessage('Could not load friends data. Please try again later.');
    }
}

function renderCalendar(friends) {
    const calendarContainer = document.querySelector('.calendar-container');
    
    // Clear existing content but keep the structure
    calendarContainer.innerHTML = '';
    
    // Get current date info
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Calculate the date of Monday (start of week)
    // If today is Sunday (0), go back 6 days, otherwise go back (currentDay - 1) days
    const mondayOffset = currentDay === 0 ? -6 : -(currentDay - 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0); // Set to beginning of day
    
    // Create a map to organize friends by day of week
    const friendsByDay = new Map();
    for (let i = 0; i < 7; i++) {
        friendsByDay.set(i, []);
    }
    
    // Create a list for friends with dates before this week
    const previousFriends = [];
    
    // Sort friends into days or previous
    friends.forEach(friend => {
        if (friend.plannedSpeakingTime) {
            const speakingDate = new Date(friend.plannedSpeakingTime);
            
            // Check if the speaking date is before this week's Monday
            if (speakingDate < monday) {
                previousFriends.push(friend);
            } else {
                const dayOfWeek = speakingDate.getDay(); // 0-6
                friendsByDay.get(dayOfWeek).push(friend);
            }
        }
    });
    
    // Create the previous column first
    calendarContainer.appendChild(createPreviousColumn(previousFriends));
    
    // Create columns for each day of the week
    for (let i = 0; i < 7; i++) {
        // Calculate the date for this day
        const columnDate = new Date(monday);
        columnDate.setDate(monday.getDate() + i);
        
        // Get correct index for the day (Monday is 1, Sunday is 0)
        const dayIndex = i === 6 ? 0 : i + 1;
        
        // Create the column for this day
        const dayColumn = createDayColumn(
            dayNames[dayIndex],
            formatDate(columnDate),
            friendsByDay.get(dayIndex)
        );
        
        calendarContainer.appendChild(dayColumn);
    }
}

function createPreviousColumn(previousFriends) {
    const column = document.createElement('div');
    column.className = 'previous-column';
    
    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `
        <div class="day-name">Previous</div>
        <div class="day-date">Overdue</div>
    `;
    
    column.appendChild(header);
    
    // Add friend boxes for previous (overdue) friends
    if (previousFriends && previousFriends.length > 0) {
        previousFriends.forEach(friend => {
            const friendBox = createFriendBox(friend);
            column.appendChild(friendBox);
        });
    }
    
    // Add "Add Context" button
    const addButton = document.createElement('div');
    addButton.className = 'add-friend';
    addButton.textContent = '+ Add Context';
    addButton.addEventListener('click', () => {
        // Future functionality to add context
        alert('Add context functionality will be implemented in the future');
    });
    
    column.appendChild(addButton);
    return column;
}

function createDayColumn(dayName, dateString, dayFriends) {
    const column = document.createElement('div');
    column.className = 'day-column';
    
    // Create header with day name and date
    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-date">${dateString}</div>
    `;
    column.appendChild(header);
    
    // Add friend boxes
    if (dayFriends && dayFriends.length > 0) {
        dayFriends.forEach(friend => {
            const friendBox = createFriendBox(friend);
            column.appendChild(friendBox);
        });
    }
    
    // Add "Add Friend" button
    const addButton = document.createElement('div');
    addButton.className = 'add-friend';
    addButton.textContent = '+ Add Friend';
    addButton.addEventListener('click', () => {
        window.location.href = '/addFriendForm/addForm.html';
    });
    
    column.appendChild(addButton);
    return column;
}

function createFriendBox(friend) {
    const box = document.createElement('div');
    
    // Determine category based on experience (you might want to customize this logic)
    let category = 'personal';
    if (friend.experience && friend.experience.toLowerCase().includes('family')) {
        category = 'family';
    } else if (friend.experience && friend.experience.toLowerCase().includes('work')) {
        category = 'work';
    }
    
    box.className = `friend-box ${category}`;
    box.innerHTML = `
        <div class="friend-name">${friend.name}</div>
        <div class="friend-time">${friend.experience || ''}</div>
    `;
    
    // Add click handler to view friend details
    box.addEventListener('click', () => {
        window.location.href = `/api/friend/profile/${friend.id}`;
    });
    
    return box;
}

function formatDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function showErrorMessage(message) {
    const container = document.querySelector('.calendar-container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    container.innerHTML = '';
    container.appendChild(errorDiv);
}