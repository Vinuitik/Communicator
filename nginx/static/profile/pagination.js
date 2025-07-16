
// Pagination variables
let currentPage = 1;
let totalPages = 5; // This will be set from backend
let totalItems = 48; // This will be set from backend

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeMediaModal();
    initializeMediaUploadButton();
    initializeMediaPagination();
});

// Initialize pagination
function initializeMediaPagination() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInput = document.getElementById('pageInput');
    const goBtn = document.getElementById('goToPageBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
    }

    if (goBtn) {
        goBtn.addEventListener('click', goToCustomPage);
    }

    if (pageInput) {
        pageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                goToCustomPage();
            }
        });
    }

    // Initial render
    renderPagination();
}

// Render pagination numbers
function renderPagination() {
    const paginationNumbers = document.getElementById('paginationNumbers');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (!paginationNumbers) return;

    paginationNumbers.innerHTML = '';

    // Update navigation buttons
    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
    }

    // Generate page numbers
    if (totalPages <= 5) {
        // Show all pages if 5 or fewer
        for (let i = 1; i <= totalPages; i++) {
            paginationNumbers.appendChild(createPageButton(i));
        }
    } else {
        // Complex pagination with input field
        if (currentPage <= 3) {
            // Show: 1 2 3 [input] ... 5
            for (let i = 1; i <= 3; i++) {
                paginationNumbers.appendChild(createPageButton(i));
            }
            paginationNumbers.appendChild(createInputContainer());
            paginationNumbers.appendChild(createPageButton(totalPages));
        } else if (currentPage >= totalPages - 2) {
            // Show: 1 ... [input] 3 4 5
            paginationNumbers.appendChild(createPageButton(1));
            paginationNumbers.appendChild(createInputContainer());
            for (let i = totalPages - 2; i <= totalPages; i++) {
                paginationNumbers.appendChild(createPageButton(i));
            }
        } else {
            // Show: 1 ... [input] ... 5
            paginationNumbers.appendChild(createPageButton(1));
            paginationNumbers.appendChild(createInputContainer());
            paginationNumbers.appendChild(createPageButton(totalPages));
        }
    }

    // Update page info
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages} • ${totalItems} items`;
    }
}

// Create page button
function createPageButton(pageNumber) {
    const button = document.createElement('button');
    button.className = 'pagination-number';
    button.textContent = pageNumber;
    button.setAttribute('data-page', pageNumber);
    
    if (pageNumber === currentPage) {
        button.classList.add('active');
    }
    
    button.addEventListener('click', () => goToPage(pageNumber));
    
    return button;
}

// Create input container
function createInputContainer() {
    const container = document.createElement('div');
    container.className = 'pagination-input-container';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'pagination-input';
    input.id = 'pageInput';
    input.min = '1';
    input.max = totalPages;
    input.placeholder = '...';
    
    const button = document.createElement('button');
    button.className = 'pagination-go-btn';
    button.textContent = 'Go';
    button.addEventListener('click', goToCustomPage);
    
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            goToCustomPage();
        }
    });
    
    container.appendChild(input);
    container.appendChild(button);
    
    return container;
}

// Go to specific page
function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    currentPage = page;
    renderPagination();
    
    // TODO: Call your backend endpoint here
    // Example: loadMediaPage(page, friendId);
    console.log(`Loading page ${page}`);
}

// Go to custom page from input
function goToCustomPage() {
    const input = document.getElementById('pageInput');
    if (!input) return;
    
    const page = parseInt(input.value);
    if (isNaN(page) || page < 1 || page > totalPages) {
        input.value = '';
        return;
    }
    
    goToPage(page);
    input.value = '';
}

// Function to update pagination from backend data
function updatePaginationData(newCurrentPage, newTotalPages, newTotalItems) {
    currentPage = newCurrentPage;
    totalPages = newTotalPages;
    totalItems = newTotalItems;
    renderPagination();
}
