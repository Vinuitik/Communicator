/**
 * Legacy Pagination.js - Simplified Version
 * This file provides backward compatibility for the old pagination structure
 */

// Legacy functions for backward compatibility
function updatePaginationData(newCurrentPage, newTotalPages, newTotalItems) {
    if (typeof Pagination !== 'undefined') {
        Pagination.updateData(newCurrentPage, newTotalPages, newTotalItems);
    }
}

// Legacy variables
let currentPage = 1;
let totalPages = 1;
let totalItems = 0;

// Update legacy variables when pagination changes
function updateLegacyPaginationVars() {
    if (typeof Pagination !== 'undefined') {
        currentPage = Pagination.currentPage;
        totalPages = Pagination.totalPages;
        totalItems = Pagination.totalItems;
    }
}

// Set up a periodic sync of legacy variables (if needed)
setInterval(updateLegacyPaginationVars, 1000);

console.log('Legacy pagination.js compatibility layer loaded');
