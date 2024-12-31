document.addEventListener('DOMContentLoaded', () => {
    const knowledgeForm = document.getElementById('knowledgeForm');
    const knowledgeTableBody = document.querySelector('#knowledgeTable tbody');

    const addKnowledgeToTable = (fact, importance) => {
        // Create a new table row
        const newRow = document.createElement('tr');
    
        // Create table cells for Fact and Importance
        const factCell = document.createElement('td');
        factCell.textContent = fact;
    
        // Make the Fact cell editable
        factCell.setAttribute('contenteditable', 'true');
        factCell.addEventListener('blur', () => {
            // Commit changes to the database when editing stops
            console.log('Fact updated:', factCell.textContent);
        });
        newRow.appendChild(factCell);
    
        const importanceCell = document.createElement('td');
        importanceCell.textContent = importance;
        importanceCell.setAttribute('contenteditable', 'true');
        importanceCell.addEventListener('blur', () => {
            // Commit changes to the database when editing stops
            console.log('Importance updated:', importanceCell.textContent);
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
            // Call a function here to remove the entry from the database if needed
        });
    
        deleteCell.appendChild(deleteButton);
        newRow.appendChild(deleteCell);
    
        // Function to find the correct insertion index using binary search
        const findInsertionIndex = (importance) => {
            const rows = Array.from(knowledgeTableBody.querySelectorAll('tr'));
            let low = 0, high = rows.length - 1;
    
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const midImportance = parseFloat(rows[mid].children[1].textContent);
    
                if (midImportance < importance) {
                    high = mid - 1;
                } else {
                    low = mid + 1;
                }
            }
    
            return low; // Low is the correct index for insertion
        };
    
        // Find the correct index for the new row
        const index = findInsertionIndex(parseFloat(importance));
    
        // Insert the row at the correct index
        const rows = knowledgeTableBody.querySelectorAll('tr');
        if (rows.length === 0 || index >= rows.length) {
            knowledgeTableBody.appendChild(newRow); // Append to the end if the table is empty or new importance is smallest
        } else {
            knowledgeTableBody.insertBefore(newRow, rows[index]);
        }
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
export const collectKnowledgeData = () => {
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

const sendKnowledgeData = () => {
    const id = getIdFromUrl();  // Get ID from the URL
    const knowledgeData = collectKnowledgeData();

    console.log('Sending data:', knowledgeData);

    // Return the fetch Promise
    return fetch(`http://localhost:8085/addKnowledge/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(knowledgeData),
    })
    .then(response => {
        console.log('Response:', response);
        return response.json()

    }) // Parse the response JSON
    .then(data => {
        console.log('Data sent successfully:', data);
        return data; // Return the data for chaining
    })
    .catch(error => {
        console.error('Error sending data:', error);
        throw error; // Rethrow the error for further handling
    });
};


const submitInfoBtn = document.getElementById('submitInfoBtn');
if (submitInfoBtn) {
    submitInfoBtn.addEventListener('click', (e) => {
        e.preventDefault();  // Prevent default button behavior (if necessary)
        
        // Collect knowledge data BEFORE clearing the table
        const knowledgeData = collectKnowledgeData();

        // Send data to the server
        sendKnowledgeData()
            .then(data => {
                // Assuming the server response includes the sent knowledge and their IDs
                if (data && data.ids) {
                    data.ids.forEach((id, index) => {
                        console.log(id, index, knowledgeData[index]);
                        const { fact, importance } = knowledgeData[index];
                        addRowToCommittedTable(fact, importance, id); // Add rows to the committed table
                    });
                }
            })
            .catch(error => {
                console.error('Error processing knowledge data:', error);
            });

        // Clear the knowledgeTable AFTER collecting the data
        const knowledgeTableBody = document.querySelector('#knowledgeTable tbody');
        if (knowledgeTableBody) {
            knowledgeTableBody.innerHTML = ''; // Clears all rows
        }
    });
}



// General function to add a row to the committedTable while maintaining sorted order by importance
const addRowToCommittedTable = (fact, importance, knowledgeId = null) => {
    const committedTableBody = document.querySelector('#committedTable tbody');
    
    // Create a new row
    const newRow = document.createElement('tr');
    newRow.setAttribute('data-id', knowledgeId); // Optional knowledgeId if provided

    // Create table cells for Fact and Importance
    const idCell = document.createElement('td');
    idCell.textContent = knowledgeId || ''; // Add the knowledgeId in the first column if available
    newRow.appendChild(idCell);

    const factCell = document.createElement('td');
    factCell.textContent = fact;
    factCell.setAttribute('contenteditable', 'true'); // Make the fact editable
    newRow.appendChild(factCell);

    const importanceCell = document.createElement('td');
    importanceCell.textContent = importance;
    importanceCell.setAttribute('contenteditable', 'true'); // Make the importance editable
    newRow.appendChild(importanceCell);

    // Create a cell for the buttons
    const buttonCell = document.createElement('td');

    // Create Update button
    const updateButton = document.createElement('button');
    updateButton.textContent = 'Update';
    updateButton.classList.add('button', 'updateKnowledgeBtn');
    buttonCell.appendChild(updateButton);

    // Create Delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('button', 'deleteKnowledgeBtn');
    buttonCell.appendChild(deleteButton);

    newRow.appendChild(buttonCell);

    // Function to find the correct insertion index using binary search based on importance
    const findInsertionIndex = (importance) => {
        const rows = Array.from(committedTableBody.querySelectorAll('tr'));
        let low = 0, high = rows.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midImportance = parseFloat(rows[mid].children[2].textContent);

            if (midImportance < importance) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        return low; // Low is the correct index for insertion
    };

    // Find the correct index for the new row
    const index = findInsertionIndex(parseFloat(importance));

    // Insert the row at the correct index
    const rows = committedTableBody.querySelectorAll('tr');
    if (rows.length === 0 || index >= rows.length) {
        committedTableBody.appendChild(newRow); // Append to the end if the table is empty or new importance is smallest
    } else {
        committedTableBody.insertBefore(newRow, rows[index]);
    }

   // Event listener for Update button
    updateButton.addEventListener('click', function() {
        handleUpdate(row, knowledgeId);
    });

    // Event listener for Delete button
    deleteButton.addEventListener('click', function() {
        handleDelete(row, knowledgeId);
    });

};

function handleUpdate(row, knowledgeId) {
    const fact = row.cells[1].innerText; // fact from the editable cell
    const importance = row.cells[2].innerText; // importance from the editable cell
    const knowledgeData = {
        id: knowledgeId, // or use row.getAttribute('data-id')
        fact: fact,
        importance: importance
    };

    // Remove the row from the table before updating
    row.remove();

    // Call the function to add the updated row back into the table (with new data)
    addRowToCommittedTable(fact, importance, knowledgeId);

    // Send request to update knowledge
    fetch(`/updateKnowledge`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(knowledgeData),
    })
    .then(response => response.text())  // Expecting a plain text response
    .then(data => {
        console.log('Knowledge updated:', data);
        // Optionally, alert the user
        // alert('Knowledge updated successfully!');
    })
    .catch(error => {
        console.error('Error updating knowledge:', error);
        // Optionally, alert the user
        // alert('Error updating knowledge, please try again.');
    });
}

// Function to handle delete logic
function handleDelete(row, knowledgeId) {
    // Send request to delete knowledge
    fetch(`/deleteKnowledge/${knowledgeId}`, {
        method: 'DELETE',
    })
    .then(response => response.text())  // Expecting a plain text response
    .then(data => {
        console.log('Knowledge deleted:', data);
        // Optionally, remove the row from the table
        row.remove();
        // alert('Knowledge deleted successfully!');
    })
    .catch(error => {
        console.error('Error deleting knowledge:', error);
        // Optionally, alert the user
        // alert('Error deleting knowledge, please try again.');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Get all rows in the table body
    const tableRows = document.querySelectorAll('#committedTable tbody tr');

    
    
    tableRows.forEach(row => {
        const updateButton = row.querySelector('.updateKnowledgeBtn');
        const deleteButton = row.querySelector('.deleteKnowledgeBtn');
        const knowledgeId = row.getAttribute('data-id'); // or use row.cells[0].innerText for the id from the first column
        
        // Event listener for Update button
        updateButton.addEventListener('click', function() {
            handleUpdate(row, knowledgeId);
        });

        // Event listener for Delete button
        deleteButton.addEventListener('click', function() {
            handleDelete(row, knowledgeId);
        });

    });

    

});

