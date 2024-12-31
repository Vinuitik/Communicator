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

function updateCharts(data) {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    // Step 1: Filter data based on the date range
    const filteredData = data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });

    // Step 2: Generate an array of all dates between start and end date, and mark with 0 or values for intensity and duration
    const allDates = [];
    const dateCounts = {};
    const intensityCounts = {};
    const durationCounts = {};
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    // Initialize data structures
    while (currentDate <= endDateObj) {
        const dateString = currentDate.toISOString().split('T')[0]; // Get date in YYYY-MM-DD format
        dateCounts[dateString] = 0; // Initialize frequency as 0
        intensityCounts[dateString] = 0; // Initialize intensity
        durationCounts[dateString] = 0; // Initialize duration

        // Check if the date exists in the filtered data
        filteredData.forEach(item => {
            if (item.date === dateString) {
                dateCounts[dateString] = 1; // Mark as 1 if there was an entry
                intensityCounts[dateString] = item.experience === "*" ? 1 : item.experience === "**" ? 2 : 3; // Intensity logic
                durationCounts[dateString] = item.hours; // Duration logic
            }
        });

        allDates.push(dateString); // Add to all dates list
        currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
    }

    // Step 3: Map the frequency, intensity, and duration data
    const frequencyData = allDates.map(date => dateCounts[date]);
    const intensityData = allDates.map(date => intensityCounts[date]);
    const durationData = allDates.map(date => durationCounts[date]);

    // Step 4: Calculate moving average for frequency, intensity, and duration (if needed)
    const smoothedFrequency = exponentialMovingAverage(frequencyData, 5); // 5-day window for EMA
    const smoothedIntensity = exponentialMovingAverage(intensityData, 5); // 5-day window for EMA
    const smoothedDuration = exponentialMovingAverage(durationData, 5); // 5-day window for EMA

    // Labels (dates for x-axis)
    const labels = allDates;

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
            datasets: [
                {
                    label: 'Duration (Hours)',
                    data: smoothedDuration,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10 // Max duration is 24 hours
                }
            }
        }
    });

    // Frequency (Talks) Chart (With EMA)
    frequencyChartInstance = new Chart(document.getElementById("frequencyChart"), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Frequency (Talks)',
                    data: smoothedFrequency,
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Intensity (Stars) Chart (With EMA)
    intensityChartInstance = new Chart(document.getElementById("intensityChart"), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Intensity (Stars)',
                    data: smoothedIntensity,
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 3 // Max intensity level is 3
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
