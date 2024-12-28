let durationChartInstance, frequencyChartInstance, intensityChartInstance;

// Example function to update the charts with the received data
function updateCharts(data) {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;

    // Step 1: Preprocess data
    const durationData = data.map(item => item.hours);
    const intensityData = data.map(item => {
        // Convert experience levels "*" -> 1, "**" -> 2, "***" -> 3
        return item.experience === "*" ? 1 : item.experience === "**" ? 2 : 3;
    });

    // Filter data based on date range
    const filteredData = data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });

    // Calculate moving averages (window size of 5 as an example)
    const movingAverage = (arr, windowSize) => {
        return arr.map((_, i) => {
            if (i < windowSize - 1) return null;
            const window = arr.slice(i - windowSize + 1, i + 1);
            const sum = window.reduce((acc, val) => acc + val, 0);
            return sum / window.length;
        });
    };

    const smoothedDuration = movingAverage(filteredData.map(item => item.hours), 5);
    const smoothedIntensity = movingAverage(intensityData, 5);
    const smoothedFrequency = movingAverage(filteredData.map(item => item.frequency), 5);

    // Step 2: Destroy existing chart instances if they exist
    if (durationChartInstance) durationChartInstance.destroy();
    if (frequencyChartInstance) frequencyChartInstance.destroy();
    if (intensityChartInstance) intensityChartInstance.destroy();

    // Step 3: Create new charts with smoothed data
    // Duration (Hours)
    durationChartInstance = new Chart(document.getElementById("durationChart"), {
        type: 'line',
        data: {
            labels: filteredData.map(item => item.date), // Dates as labels
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
                    beginAtZero: true
                }
            }
        }
    });

    // Frequency (Talks)
    frequencyChartInstance = new Chart(document.getElementById("frequencyChart"), {
        type: 'line',
        data: {
            labels: filteredData.map(item => item.date), // Dates as labels
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
                    beginAtZero: true
                }
            }
        }
    });

    // Intensity (Stars)
    intensityChartInstance = new Chart(document.getElementById("intensityChart"), {
        type: 'line',
        data: {
            labels: filteredData.map(item => item.date), // Dates as labels
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
