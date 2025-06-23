// Translation Service - Google Translate Integration
class TranslationService {
    constructor() {
        this.apiKey = null; // Will be set by user or environment
        this.currentLanguage = 'en'; // Always default to English
        this.cachedElements = new Map(); // Cache frequently used elements
        this.isTranslating = false; // Prevent concurrent translations
        this.supportedLanguages = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese (Simplified)',
            'zh-TW': 'Chinese (Traditional)',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'bn': 'Bengali',
            'ta': 'Tamil',
            'te': 'Telugu',
            'mr': 'Marathi',
            'gu': 'Gujarati',
            'kn': 'Kannada',
            'ml': 'Malayalam',
            'pa': 'Punjabi',
            'ur': 'Urdu',
            'th': 'Thai',
            'vi': 'Vietnamese',
            'tr': 'Turkish',
            'pl': 'Polish',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'da': 'Danish',
            'no': 'Norwegian',
            'fi': 'Finnish'
        };
        this.cache = new Map(); // Cache translations to avoid repeated API calls
        this.useGoogleWidget = true; // Use Google Translate Widget by default
        this.init();
    }

    init() {
        // Clear any pending translations to ensure English default
        localStorage.removeItem('pending_translation');
        // Automatically clear cache on initialization
        this.clearCache();
        this.loadGoogleTranslateWidget();
        this.handlePendingTranslation();
        this.setupAutoCacheClear();
        console.log('Translation Service initialized with English as default');
    }

    // Handle pending translation after page reload
    handlePendingTranslation() {
        const pendingLang = localStorage.getItem('pending_translation');
        if (pendingLang && pendingLang !== 'en') {
            localStorage.removeItem('pending_translation');
           
            // Apply pending translation faster
            let attempts = 0;
            const maxAttempts = 15;
           
            const applyPending = () => {
                attempts++;
               
                if (window.google && window.google.translate) {
                    console.log(`Applying pending translation to: ${pendingLang}`);
                    this.setCurrentLanguage(pendingLang);
                } else if (attempts < maxAttempts) {
                    // Check every 200ms instead of waiting 3 seconds
                    setTimeout(applyPending, 200);
                } else {
                    console.log('Failed to apply pending translation - Google Translate not ready');
                }
            };
           
            // Start checking immediately
            setTimeout(applyPending, 500);
        }
    }

    // Load Google Translate Widget (free option)
    loadGoogleTranslateWidget() {
        // Check if already loaded
        if (window.google && window.google.translate) {
            this.initializeWidget();
            return;
        }

        // Remove any existing scripts to prevent conflicts
        const existingScripts = document.querySelectorAll('script[src*="translate.google.com"]');
        existingScripts.forEach(script => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        });

        // Add Google Translate script
        const script = document.createElement('script');
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        script.onerror = () => {
            console.error('Failed to load Google Translate script');
        };
        document.head.appendChild(script);

        // Initialize Google Translate
        window.googleTranslateElementInit = () => {
            try {
                this.initializeWidget();
            } catch (error) {
                console.error('Error initializing Google Translate widget:', error);
            }
        };
    }

    // Initialize the widget
    initializeWidget() {
        try {
            // Clear any existing widget
            const widgetContainer = document.getElementById('google_translate_element');
            if (widgetContainer) {
                widgetContainer.innerHTML = '';
            }

            // Create new widget
            new window.google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: Object.keys(this.supportedLanguages).join(','),
                layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL,
                autoDisplay: false,
                multilanguagePage: true
            }, 'google_translate_element');

            // Hide the Google Translate widget by default
            setTimeout(() => {
                this.hideGoogleWidget();
            }, 1000);

            console.log('Google Translate widget initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Google Translate widget:', error);
        }
    }

    // Hide Google Translate widget (we'll use our custom UI)
    hideGoogleWidget() {
        const widget = document.getElementById('google_translate_element');
        if (widget) {
            widget.style.display = 'none';
        }
    }

    // Set API key for Google Translate API (premium option)
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.useGoogleWidget = false;
    }

    // Get supported languages
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    // Get current language
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // Set current language
    setCurrentLanguage(languageCode) {
        this.currentLanguage = languageCode;
        this.saveLanguagePreference(languageCode);
       
        // Automatically clear cache when changing languages
        this.clearCache();
       
        // Update UI language display
        this.updateLanguageDisplay();
       
        // Trigger translation if using widget
        if (this.useGoogleWidget) {
            this.translatePageWithWidget(languageCode);
        }
    }

    // Update language display in UI
    updateLanguageDisplay() {
        const languageDisplay = document.getElementById('current-language');
        if (languageDisplay) {
            languageDisplay.textContent = this.supportedLanguages[this.currentLanguage] || 'English';
        }

        const selectedLanguageDisplay = document.getElementById('selected-language');
        if (selectedLanguageDisplay) {
            selectedLanguageDisplay.textContent = this.supportedLanguages[this.currentLanguage] || 'English';
        }
    }

    // Translate page using Google Translate Widget
    translatePageWithWidget(targetLanguage) {
        // Prevent concurrent translations
        if (this.isTranslating) {
            console.log('Translation already in progress, skipping...');
            return;
        }
       
        this.isTranslating = true;
       
        // Show loading state
        this.showTranslationLoading(true);
       
        if (targetLanguage === 'en') {
            // Reset to original language
            this.resetToOriginalLanguage();
            this.isTranslating = false;
            return;
        }

        // Fast translation approach
        this.attemptFastTranslation(targetLanguage);
    }

    // Attempt fast translation without page reload
    attemptFastTranslation(targetLanguage) {
        let attempts = 0;
        const maxAttempts = 10;
       
        const tryTranslate = () => {
            attempts++;
           
            try {
                // Method 1: Try direct Google Translate API approach
                if (this.tryDirectTranslation(targetLanguage)) {
                    this.showTranslationLoading(false);
                    this.isTranslating = false;
                    return;
                }
               
                // Method 2: Try widget manipulation
                if (this.tryWidgetTranslation(targetLanguage)) {
                    this.showTranslationLoading(false);
                    this.isTranslating = false;
                    return;
                }
               
                // Method 3: Try iframe approach
                if (this.tryIframeTranslation(targetLanguage)) {
                    this.showTranslationLoading(false);
                    this.isTranslating = false;
                    return;
                }
               
                // Retry with shorter intervals
                if (attempts < maxAttempts) {
                    setTimeout(tryTranslate, 200);
                } else {
                    // Fallback to page refresh only if absolutely necessary
                    console.log('Fast translation failed, using fallback...');
                    this.fallbackTranslation(targetLanguage);
                    this.isTranslating = false;
                }
               
            } catch (error) {
                console.error('Translation attempt failed:', error);
                if (attempts < maxAttempts) {
                    setTimeout(tryTranslate, 200);
                } else {
                    this.fallbackTranslation(targetLanguage);
                }
            }
        };
       
        tryTranslate();
    }

    // Try direct translation using Google's internal methods
    tryDirectTranslation(targetLanguage) {
        if (window.google && window.google.translate && window.google.translate.translate) {
            try {
                // Use Google's internal translate function
                window.google.translate.translate(targetLanguage);
                return true;
            } catch (error) {
                console.log('Direct translation method failed:', error);
            }
        }
        return false;
    }

    // Try widget-based translation
    tryWidgetTranslation(targetLanguage) {
        try {
            // Use cached element if available
            let selectElement = this.cachedElements.get('goog-te-combo');
            if (!selectElement || !document.contains(selectElement)) {
                selectElement = document.querySelector('.goog-te-combo');
                if (selectElement) {
                    this.cachedElements.set('goog-te-combo', selectElement);
                }
            }
           
            if (selectElement && selectElement.options) {
                // Find the target language option
                for (let option of selectElement.options) {
                    if (option.value === targetLanguage) {
                        selectElement.value = targetLanguage;
                       
                        // Trigger multiple events for better compatibility
                        const events = ['change', 'click', 'input'];
                        events.forEach(eventType => {
                            const event = new Event(eventType, { bubbles: true, cancelable: true });
                            selectElement.dispatchEvent(event);
                        });
                       
                        return true;
                    }
                }
            }
        } catch (error) {
            console.log('Widget translation method failed:', error);
        }
        return false;
    }

    // Try iframe-based translation
    tryIframeTranslation(targetLanguage) {
        try {
            // Look for Google Translate iframe
            const iframe = document.querySelector('iframe[src*="translate.google"]');
            if (iframe && iframe.contentWindow) {
                // Try to communicate with iframe
                iframe.contentWindow.postMessage({
                    action: 'translate',
                    language: targetLanguage
                }, '*');
                return true;
            }
        } catch (error) {
            console.log('Iframe translation method failed:', error);
        }
        return false;
    }

    // Fallback translation (only when fast methods fail)
    fallbackTranslation(targetLanguage) {
        console.log('Using fallback translation method...');
       
        // Only refresh if we absolutely have to
        if (this.shouldUsePageRefresh(targetLanguage)) {
            localStorage.setItem('pending_translation', targetLanguage);
            window.location.reload();
        } else {
            // Try reinitializing the widget instead
            this.quickReinitialize(targetLanguage);
        }
    }

    // Quick widget reinitialization
    quickReinitialize(targetLanguage) {
        try {
            // Clear and reinitialize widget quickly
            const widgetContainer = document.getElementById('google_translate_element');
            if (widgetContainer && window.google && window.google.translate) {
                widgetContainer.innerHTML = '';
               
                setTimeout(() => {
                    new window.google.translate.TranslateElement({
                        pageLanguage: 'en',
                        includedLanguages: Object.keys(this.supportedLanguages).join(','),
                        layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL,
                        autoDisplay: false
                    }, 'google_translate_element');
                   
                    // Try translation again after reinit
                    setTimeout(() => {
                        this.tryWidgetTranslation(targetLanguage);
                        this.showTranslationLoading(false);
                    }, 500);
                }, 100);
            }
        } catch (error) {
            console.error('Quick reinitialize failed:', error);
            this.showTranslationLoading(false);
        }
    }

    // Determine if page refresh is necessary
    shouldUsePageRefresh(targetLanguage) {
        // Avoid page refresh for common languages that usually work well
        const fastLanguages = ['es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi'];
        return !fastLanguages.includes(targetLanguage);
    }

    // Reset to original language
    resetToOriginalLanguage() {
        this.showTranslationLoading(true);
       
        // Clear cache when resetting to English
        this.clearCache();
       
        try {
            // Method 1: Try direct widget reset first
            if (this.tryWidgetReset()) {
                this.showTranslationLoading(false);
                this.isTranslating = false;
                return;
            }
           
            // Method 2: Try Google's restore function
            if (this.tryDirectReset()) {
                this.showTranslationLoading(false);
                this.isTranslating = false;
                return;
            }
           
            // Method 3: Force DOM cleanup and page reset
            this.forceResetToEnglish();
           
        } catch (error) {
            console.error('Fast reset failed:', error);
            // Force reload as last resort
            this.forceResetToEnglish();
        }
    }

    // Try direct reset using Google's methods
    tryDirectReset() {
        try {
            if (window.google && window.google.translate) {
                // Try to restore original content
                if (window.google.translate.restore) {
                    window.google.translate.restore();
                    return true;
                }
               
                // Try to reset translation state
                if (window.google.translate.TranslateElement.prototype.restore) {
                    window.google.translate.TranslateElement.prototype.restore();
                    return true;
                }
            }
        } catch (error) {
            console.log('Direct reset method failed:', error);
        }
        return false;
    }

    // Try widget reset
    tryWidgetReset() {
        try {
            const selectElement = document.querySelector('.goog-te-combo');
            if (selectElement) {
                // Set back to original language (empty value means original)
                selectElement.value = '';
                selectElement.selectedIndex = 0;
               
                // Trigger multiple events for better compatibility
                const events = ['change', 'click', 'input', 'focus', 'blur'];
                events.forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true, cancelable: true });
                    selectElement.dispatchEvent(event);
                });
               
                // Also trigger with MouseEvent for click
                const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
                selectElement.dispatchEvent(clickEvent);
               
                // Wait a moment and verify reset
                setTimeout(() => {
                    this.verifyEnglishReset();
                }, 500);
               
                return true;
            }
        } catch (error) {
            console.log('Widget reset method failed:', error);
        }
        return false;
    }

    // Force reset to English with page reload if necessary
    forceResetToEnglish() {
        console.log('Forcing reset to English...');
       
        // First try fast DOM cleanup
        this.fastDOMReset();
       
        // Set a flag and reload if DOM cleanup doesn't work
        setTimeout(() => {
            if (document.body.classList.contains('goog-te-translated')) {
                console.log('DOM cleanup failed, reloading page...');
                localStorage.removeItem('pending_translation');
                window.location.reload();
            } else {
                this.showTranslationLoading(false);
                this.isTranslating = false;
            }
        }, 1000);
    }

    // Verify that English reset was successful
    verifyEnglishReset() {
        const isTranslated = document.body.classList.contains('goog-te-translated');
        if (isTranslated) {
            console.log('English reset verification failed, forcing reset...');
            this.forceResetToEnglish();
        } else {
            console.log('English reset verification successful');
            this.showTranslationLoading(false);
            this.isTranslating = false;
        }
    }

    // Fast DOM cleanup without page reload
    fastDOMReset() {
        try {
            // Remove translation classes and attributes
            document.querySelectorAll('[class*="goog-te"], [id*="goog-te"]').forEach(el => {
                if (el.id !== 'google_translate_element') {
                    el.remove();
                }
            });
           
            // Reset body classes
            document.body.className = document.body.className.replace(/goog-te-\S+/g, '').trim();
           
            // Remove translation styling
            document.querySelectorAll('style[id*="goog"]').forEach(style => style.remove());
           
            // Reset font attributes added by Google Translate
            document.querySelectorAll('[style*="font"]').forEach(el => {
                if (el.style.cssText.includes('font')) {
                    el.style.removeProperty('font-family');
                    el.style.removeProperty('font-size');
                }
            });
           
            this.showTranslationLoading(false);
           
        } catch (error) {
            console.error('Fast DOM reset failed:', error);
            this.showTranslationLoading(false);
        }
    }

    // Clear existing translation
    clearExistingTranslation() {
        try {
            // Remove Google Translate elements that might cause conflicts
            const gtElements = document.querySelectorAll('[id^="goog-gt-"], .goog-te-balloon-frame, .goog-te-menu-frame');
            gtElements.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
           
            // Reset body classes
            document.body.className = document.body.className.replace(/goog-te-\S+/g, '').trim();
           
            // Remove skiptranslate attributes that might interfere
            const elements = document.querySelectorAll('[class*="goog-te"]');
            elements.forEach(el => {
                el.className = el.className.replace(/goog-te-\S+/g, '').trim();
            });
           
        } catch (error) {
            console.error('Error clearing translation:', error);
        }
    }

    // Reinitialize the widget
    reinitializeWidget(targetLanguage) {
        console.log('Reinitializing Google Translate Widget...');
       
        // Clear cache before reinitializing
        this.clearCache();
       
        // Clear existing translation
        this.clearExistingTranslation();
       
        // Remove existing widget
        const existingWidget = document.getElementById('google_translate_element');
        if (existingWidget) {
            existingWidget.innerHTML = '';
        }
       
        // Reload the page with the target language
        // This is the most reliable way to handle Google Translate Widget
        localStorage.setItem('pending_translation', targetLanguage);
        window.location.reload();
    }

    // Handle translation errors
    handleTranslationError(targetLanguage) {
        console.error(`Failed to translate to ${targetLanguage}`);
       
        // Show error message
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast('Translation failed. Refreshing page...', 'warning');
        }
       
        // Try page reload as fallback
        setTimeout(() => {
            localStorage.setItem('pending_translation', targetLanguage);
            window.location.reload();
        }, 2000);
    }

    // Show/hide loading state
    showTranslationLoading(show) {
        const loadingElements = document.querySelectorAll('.translation-loading');
       
        if (show) {
            // Create loading overlay if it doesn't exist
            if (loadingElements.length === 0) {
                const loading = document.createElement('div');
                loading.className = 'translation-loading';
                loading.innerHTML = `
                    <div class="translation-loading-overlay">
                        <div class="translation-loading-content">
                            <div class="translation-spinner"></div>
                            <p>Translating...</p>
                            <small>This should only take a moment</small>
                        </div>
                    </div>
                `;
                document.body.appendChild(loading);
               
                // Add loading styles
                this.addLoadingStyles();
            }
        } else {
            // Remove loading overlay
            loadingElements.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        }
    }

    // Add loading styles
    addLoadingStyles() {
        if (document.getElementById('translation-loading-styles')) return;
       
        const style = document.createElement('style');
        style.id = 'translation-loading-styles';
        style.textContent = `
            .translation-loading {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
            }
           
            .translation-loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(2px);
            }
           
            .translation-loading-content {
                text-align: center;
                padding: 1.5rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border: 1px solid #e0e0e0;
                min-width: 200px;
            }
           
            .translation-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #10b981;
                border-radius: 50%;
                animation: translation-spin 1s linear infinite;
                margin: 0 auto 1rem;
            }
           
            @keyframes translation-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
           
            .translation-loading-content p {
                margin: 0;
                color: #666;
                font-size: 1rem;
            }
        `;
        document.head.appendChild(style);
    }

    // Translate text using Google Translate API (requires API key)
    async translateText(text, targetLanguage, sourceLanguage = 'en') {
        if (!this.apiKey) {
            console.warn('Google Translate API key not set. Using widget translation.');
            return text;
        }

        // Check cache first
        const cacheKey = `${sourceLanguage}-${targetLanguage}-${text}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    source: sourceLanguage,
                    target: targetLanguage,
                    format: 'text'
                })
            });

            if (!response.ok) {
                throw new Error(`Translation API error: ${response.status}`);
            }

            const data = await response.json();
            const translatedText = data.data.translations[0].translatedText;
           
            // Cache the translation
            this.cache.set(cacheKey, translatedText);
           
            return translatedText;
        } catch (error) {
            console.error('Translation failed:', error);
            return text; // Return original text if translation fails
        }
    }

    // Translate dialogue content
    async translateDialogue(dialogueText, targetLanguage) {
        if (targetLanguage === 'en' || !dialogueText) {
            return dialogueText;
        }

        if (this.useGoogleWidget) {
            // With widget, the page content is automatically translated
            return dialogueText;
        }

        // Split dialogue into lines and translate each line
        const lines = dialogueText.split('\n');
        const translatedLines = [];

        for (const line of lines) {
            if (line.trim() === '') {
                translatedLines.push(line);
                continue;
            }

            // Don't translate conversation headers
            if (line.includes('Conversation ') || line.includes('Basic Introduction')) {
                translatedLines.push(line);
                continue;
            }

            const translatedLine = await this.translateText(line, targetLanguage);
            translatedLines.push(translatedLine);
        }

        return translatedLines.join('\n');
    }

    // Save language preference
    saveLanguagePreference(languageCode) {
        localStorage.setItem('preferred_language', languageCode);
    }

    // Load language preference
    loadLanguagePreference() {
        const saved = localStorage.getItem('preferred_language');
        if (saved && this.supportedLanguages[saved]) {
            this.setCurrentLanguage(saved);
        } else {
            // Always default to English
            this.setCurrentLanguage('en');
        }
    }

    // Detect browser language (always default to English)
    detectBrowserLanguage() {
        // Always return English as default instead of detecting browser language
        return 'en';
    }

    // Setup automatic cache clearing
    setupAutoCacheClear() {
        // Clear cache when page becomes visible (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.clearCache();
            }
        });

        // Clear cache periodically (every 5 minutes)
        setInterval(() => {
            this.clearCache();
        }, 5 * 60 * 1000);

        // Clear cache when page is about to unload
        window.addEventListener('beforeunload', () => {
            this.clearCache();
        });

        // Clear cache when window loses focus
        window.addEventListener('blur', () => {
            this.clearCache();
        });
    }

    // Clear translation cache
    clearCache() {
        this.cache.clear();
        // Also clear cached elements
        this.cachedElements.clear();
        console.log('Translation cache cleared automatically');
    }

    // Get cache size
    getCacheSize() {
        return this.cache.size;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TranslationService;
} 