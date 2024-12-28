document.addEventListener('DOMContentLoaded', () => {
    const knowledgeForm = document.getElementById('knowledgeForm');
    const knowledgeTableBody = document.querySelector('#knowledgeTable tbody');

    // Function to add a new knowledge entry to the table
    const addKnowledgeToTable = (fact, importance) => {
        // Create a new table row
        const newRow = document.createElement('tr');

        // Create table cells for Fact and Importance
        const factCell = document.createElement('td');
        factCell.textContent = fact;

        // Make the Fact cell editable
        factCell.setAttribute('contenteditable', 'true');
        factCell.addEventListener('blur', () => {
            // You can commit the changes to the database here when the user stops editing
            console.log('Fact updated:', factCell.textContent);
        });
        newRow.appendChild(factCell);

        const importanceCell = document.createElement('td');
        importanceCell.textContent = importance;
        importanceCell.setAttribute('contenteditable', 'true');
        importanceCell.addEventListener('blur', () => {
            // You can commit the changes to the database here when the user stops editing
            console.log('Importance updated:', factCell.textContent);
        });
        newRow.appendChild(importanceCell);

        // Create a delete button cell
        const deleteCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        
        // Apply the existing "button" class for styling
        deleteButton.classList.add('button');
        
        // Add the click event to remove the row
        deleteButton.addEventListener('click', () => {
            newRow.remove();  // Remove the row from the table
            console.log('Fact deleted');
            // You can also call a function here to remove the entry from the database
        });
        
        deleteCell.appendChild(deleteButton);
        newRow.appendChild(deleteCell);

        // Append the new row to the table body
        knowledgeTableBody.appendChild(newRow);
    };

    // Handle form submission
    knowledgeForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent form from reloading the page

        const factInput = document.getElementById('factInput');
        const importanceInput = document.getElementById('importanceInput');

        const fact = factInput.value.trim();
        const importance = importanceInput.value.trim();

        // Only add a row if both inputs have values
        if (fact && importance) {
            addKnowledgeToTable(fact, importance);
            
            // Clear the inputs after adding the entry
            factInput.value = '';
            importanceInput.value = '';
        } else {
            alert('Please enter both a fact and its importance!');
        }
    });
});

// Function to collect knowledge entries into an array
const collectKnowledgeData = () => {
    const knowledgeEntries = [];
    const rows = document.querySelectorAll('#knowledgeTable tbody tr');

    rows.forEach(row => {
        const fact = row.cells[0].textContent;
        const importance = row.cells[1].textContent;
        knowledgeEntries.push({ fact, importance });
    });

    return knowledgeEntries;
};

// Function to get the ID from the current page URL
const getIdFromUrl = () => {
    const path = window.location.pathname;
    const id = path.split('/').pop(); // Extract the last part of the path
    return id;
};

// Function to send collected knowledge data to an endpoint
const sendKnowledgeData = () => {
    const id = getIdFromUrl();  // Get ID from the URL
    const knowledgeData = collectKnowledgeData();

    console.log('Sending data:', knowledgeData);

    fetch(`http://localhost:8085/addKnowledge/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(knowledgeData),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Data sent successfully:', data);
    })
    .catch(error => {
        console.error('Error sending data:', error);
    });
};

// Add event listener to submitInfoBtn
const submitInfoBtn = document.getElementById('submitInfoBtn');
if (submitInfoBtn) {
    submitInfoBtn.addEventListener('click', (e) => {
        e.preventDefault();  // Prevent default button behavior (if necessary)
        sendKnowledgeData(); // Call the function to send data
    });
}

