// WebSocket Chat functionality
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('message');

// Knowledge Summarization functionality
const knowledgeForm = document.getElementById('knowledgeForm');
const userIdInput = document.getElementById('userId');
const loadingDiv = document.getElementById('loading');
const knowledgeResults = document.getElementById('knowledge-results');

// Establish WebSocket connection
const socket = new WebSocket('ws://localhost:8090/api/ai/ws');

socket.onopen = () => {
    console.log('WebSocket connection established');
    displayMessage('System', 'Connected to the chat.');
};

socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received:', data);

    // Handle different message types
    if (data.type === 'ai_response' && data.content) {
        // This is the clean AI response content
        displayMessage('Agent', data.content);
    } else if (data.type === 'error') {
        displayMessage('System', `Error: ${data.message}`);
    } else {
        console.log('Unknown message type:', data);
    }
};

socket.onclose = () => {
    console.log('WebSocket connection closed');
    displayMessage('System', 'Disconnected from the chat.');
};

socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    displayMessage('System', 'An error occurred with the connection.');
};

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value;
    if (message.trim()) {
        displayMessage('You', message);
        socket.send(message);
        messageInput.value = '';
    }
});

// Knowledge Summarization form handler
knowledgeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = userIdInput.value.trim();
    
    if (!userId) {
        showError('Please enter a valid User ID');
        return;
    }
    
    await fetchKnowledgeSummary(userId);
});

function displayMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendToLastAIMessage(text) {
    // Find the last AI message or create a new one
    const messages = chatBox.querySelectorAll('.message');
    let lastAIMessage = null;
    
    // Look for the last AI message
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].innerHTML.startsWith('<strong>Agent:</strong>')) {
            lastAIMessage = messages[i];
            break;
        }
    }
    
    if (lastAIMessage) {
        // Append to existing AI message
        const currentContent = lastAIMessage.innerHTML;
        lastAIMessage.innerHTML = currentContent + text;
    } else {
        // Create new AI message
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.innerHTML = `<strong>Agent:</strong> ${text}`;
        chatBox.appendChild(messageElement);
    }
    
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Knowledge Summarization Functions
async function fetchKnowledgeSummary(userId) {
    try {
        showLoading(true);
        clearResults();
        
        const response = await fetch(`http://localhost:8090/api/ai/summarize-knowledge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                friend_id: parseInt(userId)  // Backend expects friend_id as integer
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        displayKnowledgeResults(data, userId);
        
    } catch (error) {
        console.error('Error fetching knowledge summary:', error);
        showError(`Failed to fetch knowledge summary: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function displayKnowledgeResults(data, userId) {
    const resultsContainer = knowledgeResults;
    
    // Create header
    const header = document.createElement('div');
    header.className = 'success-message';
    header.innerHTML = `<strong>Knowledge Summary for User ID: ${userId}</strong>`;
    resultsContainer.appendChild(header);
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
        const noDataMsg = document.createElement('div');
        noDataMsg.className = 'knowledge-item';
        noDataMsg.innerHTML = '<div class="knowledge-content">No knowledge data found for this user.</div>';
        resultsContainer.appendChild(noDataMsg);
        return;
    }
    
    // Handle different response formats
    if (Array.isArray(data)) {
        displayKnowledgeArray(data, resultsContainer);
    } else if (typeof data === 'object') {
        displayKnowledgeObject(data, resultsContainer);
    } else {
        displayKnowledgeText(data, resultsContainer);
    }
}

function displayKnowledgeArray(dataArray, container) {
    // Create table for array data
    const table = document.createElement('table');
    table.className = 'knowledge-table';
    
    if (dataArray.length > 0) {
        // Create header row based on first object's keys
        const firstItem = dataArray[0];
        if (typeof firstItem === 'object') {
            const headerRow = document.createElement('tr');
            Object.keys(firstItem).forEach(key => {
                const th = document.createElement('th');
                th.textContent = formatHeaderName(key);
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);
            
            // Create data rows
            dataArray.forEach(item => {
                const row = document.createElement('tr');
                Object.values(item).forEach(value => {
                    const td = document.createElement('td');
                    td.textContent = formatCellValue(value);
                    row.appendChild(td);
                });
                table.appendChild(row);
            });
        } else {
            // Simple array of primitives
            const headerRow = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = 'Knowledge Items';
            headerRow.appendChild(th);
            table.appendChild(headerRow);
            
            dataArray.forEach(item => {
                const row = document.createElement('tr');
                const td = document.createElement('td');
                td.textContent = formatCellValue(item);
                row.appendChild(td);
                table.appendChild(row);
            });
        }
    }
    
    container.appendChild(table);
}

function displayKnowledgeObject(dataObject, container) {
    // Display object as key-value pairs
    Object.entries(dataObject).forEach(([key, value]) => {
        const item = document.createElement('div');
        item.className = 'knowledge-item';
        
        const category = document.createElement('div');
        category.className = 'knowledge-category';
        category.textContent = formatHeaderName(key);
        
        const content = document.createElement('div');
        content.className = 'knowledge-content';
        
        if (Array.isArray(value)) {
            content.innerHTML = value.map(v => `• ${formatCellValue(v)}`).join('<br>');
        } else if (typeof value === 'object') {
            content.textContent = JSON.stringify(value, null, 2);
        } else {
            content.textContent = formatCellValue(value);
        }
        
        item.appendChild(category);
        item.appendChild(content);
        container.appendChild(item);
    });
}

function displayKnowledgeText(data, container) {
    const item = document.createElement('div');
    item.className = 'knowledge-item';
    
    const content = document.createElement('div');
    content.className = 'knowledge-content';
    content.textContent = data.toString();
    
    item.appendChild(content);
    container.appendChild(item);
}

function formatHeaderName(key) {
    return key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .replace(/_/g, ' ');
}

function formatCellValue(value) {
    if (value === null || value === undefined) {
        return 'N/A';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return value.toString();
}

function showLoading(show) {
    loadingDiv.classList.toggle('hidden', !show);
    const submitBtn = knowledgeForm.querySelector('button');
    submitBtn.disabled = show;
    submitBtn.textContent = show ? 'Loading...' : 'Get Knowledge Summary';
}

function showError(message) {
    clearResults();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    knowledgeResults.appendChild(errorDiv);
}

function clearResults() {
    knowledgeResults.innerHTML = '';
}
