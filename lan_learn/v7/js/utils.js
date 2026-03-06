// Additional Utility Functions
// This file contains any additional utility functions that might be needed

// Create or extend the global Utils object
if (typeof Utils === 'undefined') {
    window.Utils = {};
}

// Add essential utility methods first
Utils.showToast = function(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        padding: 12px 20px; margin-bottom: 10px; border-radius: 4px;
        color: white; font-weight: 500; min-width: 250px;
        animation: slideIn 0.3s ease-out;
        background-color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (toast && toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }, 3000);
};

Utils.generateId = function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

Utils.validateInput = function(value, type = 'text') {
    if (!value || value.trim().length === 0) return false;
    
    switch (type) {
        case 'name':
            return value.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(value.trim());
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
        default:
            return value.trim().length > 0;
    }
};

Utils.formatName = function(name) {
    return name.trim().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

Utils.getFromStorage = function(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return defaultValue;
    }
};

Utils.saveToStorage = function(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
};

Utils.removeFromStorage = function(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
    }
};

// Extend the global Utils object with additional functions
if (typeof Utils !== 'undefined') {
    // Language detection and formatting
    Utils.detectLanguageDirection = function(text) {
        // Simple RTL language detection
        const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        return rtlChars.test(text) ? 'rtl' : 'ltr';
    };

    // Text sanitization
    Utils.sanitizeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // Debounce function for performance optimization
    Utils.debounce = function(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    };

    // Check if device is mobile
    Utils.isMobile = function() {
        return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    // Copy text to clipboard
    Utils.copyToClipboard = function(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful ? Promise.resolve() : Promise.reject();
            } catch (err) {
                document.body.removeChild(textArea);
                return Promise.reject(err);
            }
        }
    };

    // Format time in a readable format
    Utils.formatTime = function(date) {
        if (!date) return '';
        const now = new Date();
        const time = new Date(date);
        const diffInSeconds = Math.floor((now - time) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return time.toLocaleDateString();
    };

    // Deep clone object
    Utils.deepClone = function(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = Utils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    };

    // Check if element is in viewport
    Utils.isInViewport = function(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    };

    // Smooth scroll to element
    Utils.smoothScrollTo = function(element, offset = 0) {
        if (!element) return;
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    };

    // Get CSS variable value
    Utils.getCSSVariable = function(variableName) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(variableName)
            .trim();
    };

    // Set CSS variable
    Utils.setCSSVariable = function(variableName, value) {
        document.documentElement.style.setProperty(variableName, value);
    };

    // Show popup
    Utils.showPopup = function(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.display = 'flex';
            popup.classList.add('active');
            // Add fade-in animation
            popup.style.opacity = '0';
            setTimeout(() => {
                popup.style.opacity = '1';
            }, 10);
        }
    };

    // Hide popup
    Utils.hidePopup = function(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) {
            popup.style.opacity = '0';
            setTimeout(() => {
                popup.style.display = 'none';
                popup.classList.remove('active');
            }, 300);
        }
    };

    console.log('Additional utils loaded');
}

// Performance monitoring
const PerformanceMonitor = {
    marks: {},

    start(name) {
        this.marks[name] = performance.now();
    },

    end(name) {
        if (this.marks[name]) {
            const duration = performance.now() - this.marks[name];
            console.log(`${name} took ${duration.toFixed(2)}ms`);
            delete this.marks[name];
            return duration;
        }
    },

    measure(name, fn) {
        this.start(name);
        const result = fn();
        this.end(name);
        return result;
    }
};

// Export if module system is available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceMonitor };
}

// Make available globally
window.PerformanceMonitor = PerformanceMonitor; 