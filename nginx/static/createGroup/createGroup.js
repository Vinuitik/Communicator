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
});

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
        let isValid = true;

        if (nameInput && !validateName(nameInput)) {
            isValid = false;
        }

        if (!isValid) {
            e.preventDefault();
            showError('Please fix the validation errors before submitting.');
            return false;
        }

        // Add loading state
        addLoadingState(form);
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
 * Show error message
 * @param {string} message - The error message
 */
function showError(message) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
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
