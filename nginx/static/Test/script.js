const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('message');

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
