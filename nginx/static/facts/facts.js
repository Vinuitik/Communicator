// facts.js
// Friend Knowledge Management
// This file uses the shared KnowledgeManager with friend-specific configuration

import { KnowledgeManager } from '/shared/knowledgeManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Configure the knowledge manager for friends
    const friendKnowledgeConfig = {
        apiBaseUrl: '/api/friend',
        entityType: 'friend',
        entityIdKey: 'friendId',
        textFieldName: 'fact',        // JSON property name for friend facts
        priorityFieldName: 'importance', // JSON property name for friend facts
        pageSize: 10
    };
    
    // Initialize the knowledge manager
    const knowledgeManager = new KnowledgeManager(friendKnowledgeConfig);
    
    console.log('Friend Knowledge Manager initialized');
    
    // Export methods for backward compatibility
    window.KnowledgeTableManager = {
        collectKnowledgeData: () => knowledgeManager.collectKnowledgeData(),
        sendKnowledgeData: (knowledgeData) => knowledgeManager.sendKnowledgeData(knowledgeData),
        getIdFromUrl: () => knowledgeManager.getIdFromUrl()
    };
});

// Export for module-based systems (backward compatibility)
export const collectKnowledgeData = () => {
    const knowledgeEntries = [];
    const rows = document.querySelectorAll('#knowledgeTable tbody tr');

    rows.forEach(row => {
        const fact = row.cells[0].textContent;
        const importance = row.cells[1].textContent;
        knowledgeEntries.push({ fact: fact, importance: parseInt(importance) });
    });

    return knowledgeEntries;
};

export const sendKnowledgeData = (knowledgeData) => {
    const path = window.location.pathname;
    const id = path.split('/').pop();
    
    console.log('Sending data:', knowledgeData);
    
    return fetch(`/api/friend/addKnowledge/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(knowledgeData)
    })
    .then(response => {
        console.log('Response:', response);
        return response.json();
    })
    .then(data => {
        console.log('Data sent successfully:', data);
        return data;
    })
    .catch(error => {
        console.error('Error sending data:', error);
        throw error;
    });
};

export const getIdFromUrl = () => {
    const path = window.location.pathname;
    return path.split('/').pop();
};