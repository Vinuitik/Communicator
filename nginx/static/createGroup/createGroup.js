// createGroup.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('Create Group page loaded');
    
    // Auto-hide flash messages after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, 5000);
    });

    // Initialize form validation
    initializeFormValidation();
    
    // Initialize character counters
    initializeCharacterCounters();

    // Initialize navigation handlers
    initializeNavigation();
});

/**
 * Navigate to groups list page
 */
function navigateToGroups() {
    // Use relative path to stay within nginx routing context
    // This ensures we stay on the same domain/port (localhost:8090)
    window.location.href = '/groups';
}

/**
 * Initialize navigation handlers
 */
function initializeNavigation() {
    // Handle back to groups button
    const backButtons = document.querySelectorAll('a[href="/groups"], .button[href="/groups"]');
    backButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            navigateToGroups();
        });
    });
}

/**
 * Initialize form validation
 */
function initializeFormValidation() {
    const form = document.querySelector('.group-form');
    if (!form) return;

    const nameInput = document.getElementById('name');

    // Real-time validation for name
    if (nameInput) {
        nameInput.addEventListener('input', function() {
            validateName(this);
        });

        nameInput.addEventListener('blur', function() {
            validateName(this);
        });
    }

    // Form submission validation
    form.addEventListener('submit', function(e) {
        e.preventDefault(); // Always prevent default form submission
        
        let isValid = true;

        if (nameInput && !validateName(nameInput)) {
            isValid = false;
        }

        if (!isValid) {
            showError('Please fix the validation errors before submitting.');
            return false;
        }

        // Submit via AJAX
        submitGroupForm(form);
    });
}

/**
 * Submit the group form via AJAX
 * @param {HTMLElement} form - The form element
 */
function submitGroupForm(form) {
    // Add loading state
    addLoadingState(form);

    // Get form data
    const formData = new FormData(form);
    const groupData = {
        name: formData.get('name'),
        description: formData.get('description') || ''
    };

    // Make API call with better error handling
    fetch('/api/groups', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(groupData)
    })
    .then(response => {
        if (!response.ok) {
            // If API fails, try to parse error message
            return response.json().catch(() => {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }).then(errorData => {
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showSuccessMessage(data.message);
            // Navigate to groups list after a short delay
            setTimeout(() => {
                navigateToGroups();
            }, 1500);
        } else {
            showErrorMessage(data.message);
            removeLoadingState(form);
        }
    })
    .catch(error => {
        console.error('Error creating group:', error);
        showErrorMessage('Failed to create group. Please try again.');
        removeLoadingState(form);
    });
}

/**
 * Validate name input
 * @param {HTMLElement} input - The name input element
 * @returns {boolean} - Whether the input is valid
 */
function validateName(input) {
    const value = input.value.trim();
    const minLength = 2;
    const maxLength = 100;

    // Remove existing feedback
    removeFeedback(input);

    if (!value) {
        addInvalidFeedback(input, 'Group name is required.');
        return false;
    }

    if (value.length < minLength) {
        addInvalidFeedback(input, `Group name must be at least ${minLength} characters long.`);
        return false;
    }

    if (value.length > maxLength) {
        addInvalidFeedback(input, `Group name must not exceed ${maxLength} characters.`);
        return false;
    }

    // Check for invalid characters (basic validation)
    const invalidChars = /[<>\"\'&]/;
    if (invalidChars.test(value)) {
        addInvalidFeedback(input, 'Group name contains invalid characters.');
        return false;
    }

    addValidFeedback(input, 'Group name looks good!');
    return true;
}

/**
 * Add invalid feedback to input
 * @param {HTMLElement} input - The input element
 * @param {string} message - The error message
 */
function addInvalidFeedback(input, message) {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');

    const feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    feedback.textContent = message;
    input.parentNode.appendChild(feedback);
}

/**
 * Add valid feedback to input
 * @param {HTMLElement} input - The input element
 * @param {string} message - The success message
 */
function addValidFeedback(input, message) {
    input.classList.add('is-valid');
    input.classList.remove('is-invalid');

    const feedback = document.createElement('div');
    feedback.className = 'valid-feedback';
    feedback.textContent = message;
    input.parentNode.appendChild(feedback);
}

/**
 * Remove feedback from input
 * @param {HTMLElement} input - The input element
 */
function removeFeedback(input) {
    input.classList.remove('is-valid', 'is-invalid');
    
    const existingFeedback = input.parentNode.querySelectorAll('.invalid-feedback, .valid-feedback');
    existingFeedback.forEach(feedback => feedback.remove());
}

/**
 * Initialize character counters
 */
function initializeCharacterCounters() {
    const nameInput = document.getElementById('name');

    if (nameInput) {
        addCharacterCounter(nameInput, 100);
    }
}

/**
 * Add character counter to input
 * @param {HTMLElement} input - The input element
 * @param {number} maxLength - The maximum length
 */
function addCharacterCounter(input, maxLength) {
    const counter = document.createElement('div');
    counter.className = 'character-counter';
    counter.style.cssText = `
        font-size: 0.9rem;
        color: #6c757d;
        margin-top: 5px;
        text-align: right;
    `;

    input.parentNode.appendChild(counter);

    function updateCounter() {
        const remaining = maxLength - input.value.length;
        counter.textContent = `${input.value.length}/${maxLength} characters`;
        
        if (remaining < 10) {
            counter.style.color = '#dc3545';
        } else if (remaining < 50) {
            counter.style.color = '#ffc107';
        } else {
            counter.style.color = '#6c757d';
        }
    }

    input.addEventListener('input', updateCounter);
    updateCounter(); // Initialize
}

/**
 * Add loading state to form
 * @param {HTMLElement} form - The form element
 */
function addLoadingState(form) {
    form.classList.add('loading');
    
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Creating Group...';
    }
}

/**
 * Remove loading state from form
 * @param {HTMLElement} form - The form element
 */
function removeLoadingState(form) {
    form.classList.remove('loading');
    
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Create Group';
    }
}

/**
 * Show success message
 * @param {string} message - The success message
 */
function showSuccessMessage(message) {
    showMessage(message, 'alert-success');
}

/**
 * Show error message
 * @param {string} message - The error message
 */
function showErrorMessage(message) {
    showMessage(message, 'alert-error');
}

/**
 * Show message with specified type
 * @param {string} message - The message to show
 * @param {string} type - The alert type (alert-success, alert-error, etc.)
 */
function showMessage(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.textContent = message;

    // Insert at the top of the container
    const container = document.querySelector('.container');
    const firstChild = container.querySelector('h1').nextElementSibling;
    container.insertBefore(alert, firstChild);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => {
            alert.remove();
        }, 300);
    }, 5000);
}

/**
 * Show error message
 * @param {string} message - The error message
 */
function showError(message) {
    showErrorMessage(message);
}
