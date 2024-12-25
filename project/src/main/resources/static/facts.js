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
        newRow.appendChild(factCell);

        const importanceCell = document.createElement('td');
        importanceCell.textContent = importance;
        newRow.appendChild(importanceCell);

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
