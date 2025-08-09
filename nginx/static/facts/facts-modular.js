// Friend Facts Management
// This file uses the shared KnowledgeManager with friend-specific configuration

import { KnowledgeManager } from '/shared/knowledgeManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Configure the knowledge manager for friends
    const friendFactsConfig = {
        apiBaseUrl: '/api/friend',
        entityType: 'friend',
        entityIdKey: 'friendId',
        textFieldName: 'text',
        priorityFieldName: 'priority',
        pageSize: 10
    };
    
    // Initialize the knowledge manager
    const knowledgeManager = new KnowledgeManager(friendFactsConfig);
    
    console.log('Friend Facts Manager initialized');
});
