// Group Knowledge Management
// This file uses the shared KnowledgeManager with group-specific configuration

import { KnowledgeManager } from '/shared/knowledgeManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Configure the knowledge manager for groups
    const groupKnowledgeConfig = {
        apiBaseUrl: '/api/group',
        entityType: 'group',
        entityIdKey: 'groupId',
        textFieldName: 'text',
        priorityFieldName: 'priority',
        pageSize: 10
    };
    
    // Initialize the knowledge manager
    const knowledgeManager = new KnowledgeManager(groupKnowledgeConfig);
    
    console.log('Group Knowledge Manager initialized');
});
