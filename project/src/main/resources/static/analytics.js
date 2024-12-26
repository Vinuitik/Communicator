let durationChartInstance, frequencyChartInstance, intensityChartInstance;

// Example function to update the charts with the received data
function updateCharts(data) {
    // Assuming data contains an array of objects with 'duration', 'frequency', and 'intensity'
    const durationData = data.map(item => item.duration);
    const frequencyData = data.map(item => item.frequency);
    const intensityData = data.map(item => item.intensity);

    // Destroy existing chart instances if they exist
    if (durationChartInstance) {
        durationChartInstance.destroy();
    }
    if (frequencyChartInstance) {
        frequencyChartInstance.destroy();
    }
    if (intensityChartInstance) {
        intensityChartInstance.destroy();
    }

    // Create new chart instances for each graph with the updated data
    durationChartInstance = new Chart(document.getElementById("durationChart"), {
        type: 'line',
        data: {
            labels: data.map(item => item.date), // Dates as labels
            datasets: [{
                label: 'Duration (Hours)',
                data: durationData,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
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

    frequencyChartInstance = new Chart(document.getElementById("frequencyChart"), {
        type: 'line',
        data: {
            labels: data.map(item => item.date), // Dates as labels
            datasets: [{
                label: 'Frequency (Talks)',
                data: frequencyData,
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.1
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

    intensityChartInstance = new Chart(document.getElementById("intensityChart"), {
        type: 'line',
        data: {
            labels: data.map(item => item.date), // Dates as labels
            datasets: [{
                label: 'Intensity (Stars)',
                data: intensityData,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
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
                    <td>${item.friendName}</td>
                    <td>${item.date}</td>
                    <td>${item.duration}</td>
                    <td>${item.frequency}</td>
                    <td>${item.intensity}</td>
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
