let durationChartInstance, frequencyChartInstance, intensityChartInstance;

// Function to calculate the exponential moving average (EMA)
const exponentialMovingAverage = (arr, windowSize) => {
    const alpha = 2 / (windowSize + 1);
    let ema = [];
    let previousEma = arr[0]; // First value is used to initialize the EMA

    // Loop through the array to calculate EMA
    for (let i = 0; i < arr.length; i++) {
        previousEma = alpha * arr[i] + (1 - alpha) * previousEma;
        ema.push(previousEma);
    }

    return ema;
};

// Function to calculate EMA with a per-day alpha array
const exponentialMovingAverageWithAlphaArray = (arr, alphaArr) => {
    let ema = [];
    let previousEma = arr[0];
    for (let i = 0; i < arr.length; i++) {
        previousEma = alphaArr[i] * arr[i] + (1 - alphaArr[i]) * previousEma;
        ema.push(previousEma);
    }
    return ema;
};

function updateCharts(data) {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    // Step 1: Filter data based on the date range
    const filteredData = data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });

    // Build dictionaries for O(1) lookup, processing multiple entries per date
    const feedbackByDate = {};
    const totalDurationByDate = {};
    const frequencyByDate = {};
    const lastIntensityByDate = {};

    filteredData.forEach(item => {
        const date = item.date;
        
        // Update total duration
        totalDurationByDate[date] = (totalDurationByDate[date] || 0) + item.hours;
        
        // Update frequency count
        frequencyByDate[date] = (frequencyByDate[date] || 0) + 1;
        
        // Keep track of last intensity (latest feedback for the day)
        lastIntensityByDate[date] = item.experience === "*" ? 1 : 
                                   item.experience === "**" ? 2 : 3;
        
        // Store the last feedback for alpha calculation
        feedbackByDate[date] = item;
    });

    // Step 2: Generate arrays of all dates between start and end date
    const allDates = [];
    const dateCounts = {};
    const intensityCounts = {};
    const durationCounts = {};
    const alphaArray = [];
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    // For tracking previous alpha and experience level
    let prevAlpha = 0;
    let lastExperience = "*"; // Default to lowest
    
    // Different alpha sets for new data vs decay
    const newDataAlpha = {
        "***": 0.6,  // High responsiveness to new data
        "**": 0.7,
        "*": 0.8
    };
    
    const decayAlpha = {
        "***": 0.07, // Very slow decay for good experiences
        "**": 0.2,
        "*": 0.57
    };

    while (currentDate <= endDateObj) {
        const dateString = currentDate.toISOString().split('T')[0];
        
        // Set values from our processed dictionaries, defaulting to 0 if no data
        dateCounts[dateString] = frequencyByDate[dateString] || 0;
        intensityCounts[dateString] = lastIntensityByDate[dateString] || 0;
        durationCounts[dateString] = totalDurationByDate[dateString] || 0;

        // Use dictionary for O(1) lookup for alpha calculation
        const feedback = feedbackByDate[dateString];

        if (feedback) {
            lastExperience = feedback.experience; // Update last known experience
            // Use higher alpha for new data
            prevAlpha = newDataAlpha[feedback.experience];
        } else {
            // Use decay alpha based on last experience when value is 0
            prevAlpha = decayAlpha[lastExperience];
        }

        alphaArray.push(prevAlpha);
        allDates.push(dateString);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Step 3: Map the frequency, intensity, and duration data
    const frequencyData = allDates.map(date => dateCounts[date]);
    const intensityData = allDates.map(date => intensityCounts[date]);
    const durationData = allDates.map(date => durationCounts[date]);

    // Step 4: Calculate moving average for frequency, intensity, and duration (if needed)
    const smoothedFrequency = exponentialMovingAverageWithAlphaArray(frequencyData, alphaArray); // unchanged
    const smoothedIntensity = exponentialMovingAverageWithAlphaArray(intensityData, alphaArray); // new logic
    const smoothedDuration = exponentialMovingAverageWithAlphaArray(durationData, alphaArray); // unchanged

    console.log(smoothedDuration);
    console.log(smoothedFrequency);
    console.log(smoothedIntensity);

    // Labels (dates for x-axis)
    const labels = allDates;

    // Calculate maximum values for scaling
    const maxDuration = Math.max(2, Math.max(...smoothedDuration));
    const maxIntensity = Math.max(3, Math.max(...smoothedIntensity));
    const maxFrequency = Math.max(2, Math.max(...smoothedFrequency));

    // Step 5: Create and render the charts
    // Destroy previous chart instances if they exist
    if (durationChartInstance) durationChartInstance.destroy();
    if (frequencyChartInstance) frequencyChartInstance.destroy();
    if (intensityChartInstance) intensityChartInstance.destroy();

    // Duration (Hours) Chart (With EMA)
    durationChartInstance = new Chart(document.getElementById("durationChart"), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Duration (Hours)',
                data: smoothedDuration,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxDuration
                }
            }
        }
    });

    // Frequency (Talks) Chart (With EMA)
    frequencyChartInstance = new Chart(document.getElementById("frequencyChart"), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency (Talks)',
                data: smoothedFrequency,
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxFrequency
                }
            }
        }
    });

    // Intensity (Stars) Chart (With EMA)
    intensityChartInstance = new Chart(document.getElementById("intensityChart"), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Intensity (Stars)',
                data: smoothedIntensity,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxIntensity
                }
            }
        }
    });
}

// Function to fetch the friend list and populate the dropdown
async function fetchFriendList() {
    try {
        // Sending GET request to /shortList endpoint
        const response = await fetch('/shortList');
        const friends = await response.json();
        friends.sort((a, b) => a.name.localeCompare(b.name));

        // Find the select element for the friend dropdown
        const friendSelect = document.getElementById('friend-select');

        // Clear existing options (if any)
        friendSelect.innerHTML = '';

        // Add a default option to the dropdown
        const defaultOption = document.createElement('option');
        defaultOption.value = '';  // No friend selected
        defaultOption.textContent = 'Select a Friend';
        friendSelect.appendChild(defaultOption);

        // Loop through the list of friends and add each to the dropdown
        friends.forEach(friend => {
            const option = document.createElement('option');
            option.value = friend.id;  // Use the id as the value
            option.textContent = friend.name;  // Display the name
            friendSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching friend list:', error);
    }
}

// Call the function to populate the dropdown when the page loads
document.addEventListener('DOMContentLoaded', fetchFriendList);

// Event listener for the "Apply Filters" button
document.getElementById("apply-filters").addEventListener("click", function() {
    // Get filter values
    const friendId = document.getElementById("friend-select").value;
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    // Validate the inputs
    if (!friendId || !startDate || !endDate) {
        alert("Please fill in all fields.");
        return;
    }

    // Validate date range
    if (new Date(endDate) <= new Date(startDate)) {
        alert("End date must be after start date.");
        return;
    }

    // Construct the URL with query parameters
    const url = `/analyticsList?friendId=${friendId}&left=${startDate}&right=${endDate}`;

    // Make the GET request
    fetch(url)
        .then(response => response.json()) // Parse JSON response
        .then(data => {
            // Log the data to console (for now)
            console.log(data);

            // Populate the data table
            const tableBody = document.getElementById("data-table-body");
            tableBody.innerHTML = ''; // Clear previous results

            data.forEach(item => {
                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.date}</td>
                    <td>${item.hours}</td>
                    <td>${item.experience}</td>
                `;

                tableBody.appendChild(row);
            });

            // Optionally: Update the chart with the data
            updateCharts(data);
        })
        .catch(error => {
            console.error("Error fetching data:", error);
        });
});
