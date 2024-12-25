const ctx = document.getElementById('durationChart').getContext('2d');
const durationChart = new Chart(ctx, {
    type: 'line', // Or 'bar', 'pie', etc.
    data: {
        labels: ['Friend 1', 'Friend 2', 'Friend 3'], // Dynamic data here
        datasets: [{
            label: 'Duration (Hours)',
            data: [5, 10, 3], // Dynamic data here
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
