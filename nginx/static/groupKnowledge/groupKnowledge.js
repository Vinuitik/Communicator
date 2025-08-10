// groupKnowledge.js
// Group Knowledge Management
// This file uses the shared KnowledgeManager with group-specific configuration

import { KnowledgeManager } from '/shared/knowledgeManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Configure the knowledge manager for groups
    const groupKnowledgeConfig = {
        apiBaseUrl: '/api/groups',
        entityType: 'group',
        entityIdKey: 'groupId',
        textFieldName: 'fact',        // JSON property name
        priorityFieldName: 'importance',  // JSON property name
        pageSize: 10
    };
    
    // Initialize the knowledge manager
    const knowledgeManager = new KnowledgeManager(groupKnowledgeConfig);
    
    console.log('Group Knowledge Manager initialized');
});
