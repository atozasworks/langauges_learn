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
        // Check if we need to ensure English display
        const ensureEnglish = localStorage.getItem('ensure_english_display');
        if (ensureEnglish) {
            localStorage.removeItem('ensure_english_display');
            console.log('Ensuring English display - blocking all translations');
            this.blockAllTranslations();
            this.currentLanguage = 'en';
            this.updateLanguageDisplay();
            console.log('Translation Service initialized - English display ensured');
            return;
        }
        
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
            
            // Apply pending translation faster with optimized timing
            let attempts = 0;
            const maxAttempts = 20;
            
            const applyPending = () => {
                attempts++;
                
                if (window.google && window.google.translate) {
                    console.log(`Applying pending translation to: ${pendingLang}`);
                    this.setCurrentLanguage(pendingLang);
                } else if (attempts < maxAttempts) {
                    // Much faster checking - every 100ms initially, then 150ms
                    const delay = attempts <= 10 ? 100 : 150;
                    setTimeout(applyPending, delay);
                } else {
                    console.log('Failed to apply pending translation - Google Translate not ready');
                }
            };
            
            // Start checking much sooner
            setTimeout(applyPending, 200);
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

            // Create new widget configured for direct translation from English
            new window.google.translate.TranslateElement({
                pageLanguage: 'en', // Always translate FROM English
                includedLanguages: Object.keys(this.supportedLanguages).join(','),
                layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL,
                autoDisplay: false,
                multilanguagePage: false // Disable multilanguage to ensure direct translation
            }, 'google_translate_element');

            // Hide the Google Translate widget by default - faster timing
            setTimeout(() => {
                this.hideGoogleWidget();
            }, 300);

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
        console.log(`Setting current language to: ${languageCode} (${this.supportedLanguages[languageCode]})`);
        
        // Validate language code
        if (!this.supportedLanguages[languageCode]) {
            console.error(`Unsupported language code: ${languageCode}`);
            return;
        }
        
        // If switching from English mode to another language, re-enable widget functionality
        if (languageCode !== 'en' && !this.useGoogleWidget) {
            console.log('Switching from English mode to translation mode - re-enabling widget');
            this.reEnableWidgetFromEnglishMode(languageCode);
            return;
        }
        
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
            // Immediate page reload to ensure clean English state
            console.log('English selected - reloading page to ensure English display');
            localStorage.setItem('ensure_english_display', 'true');
            localStorage.removeItem('preferred_language');
            localStorage.removeItem('pending_translation');
            window.location.reload();
            return;
        }

        // Fast translation approach
        this.attemptFastTranslation(targetLanguage);
    }

    // Attempt fast translation without page reload
    attemptFastTranslation(targetLanguage) {
        let attempts = 0;
        const maxAttempts = 12; // Reduced for faster completion
        
        const tryTranslate = () => {
            attempts++;
            console.log(`Fast translation attempt ${attempts}/${maxAttempts} for ${targetLanguage}`);
            
            try {
                // Method 1: Try direct Google Translate API approach
                if (this.tryDirectTranslation(targetLanguage)) {
                    console.log('Direct translation method succeeded');
                    this.showTranslationLoading(false);
                    this.isTranslating = false;
                    return;
                }
                
                // Method 2: Try widget manipulation
                if (this.tryWidgetTranslation(targetLanguage)) {
                    console.log('Widget translation method succeeded');
                    // Verify the correct language was applied
                    this.verifyLanguageTranslation(targetLanguage);
                    this.showTranslationLoading(false);
                    this.isTranslating = false;
                    return;
                }
                
                // Method 3: Try iframe approach
                if (this.tryIframeTranslation(targetLanguage)) {
                    console.log('Iframe translation method succeeded');
                    this.showTranslationLoading(false);
                    this.isTranslating = false;
                    return;
                }
                
                // Retry with faster intervals - much more aggressive timing
                if (attempts < maxAttempts) {
                    const delay = attempts <= 3 ? 100 : attempts <= 6 ? 200 : attempts <= 9 ? 300 : 500;
                    setTimeout(tryTranslate, delay);
                } else {
                    // Fallback only after all attempts failed
                    console.log('All fast translation attempts failed, using fallback...');
                    this.fallbackTranslation(targetLanguage);
                    this.isTranslating = false;
                }
                
            } catch (error) {
                console.error('Translation attempt failed:', error);
                if (attempts < maxAttempts) {
                    const delay = attempts <= 3 ? 100 : attempts <= 6 ? 200 : 400;
                    setTimeout(tryTranslate, delay);
                } else {
                    console.log('Translation attempts exhausted due to errors, using fallback...');
                    this.fallbackTranslation(targetLanguage);
                    this.isTranslating = false;
                }
            }
        };
        
        // Start immediately - no initial delay
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
                console.log(`Attempting translation to: ${targetLanguage} (${this.supportedLanguages[targetLanguage]})`);
                console.log('Available Google Translate options:', Array.from(selectElement.options).map(opt => opt.value));
                
                // Special handling for Indian languages that might get confused with Arabic
                const languageMapping = {
                    'kn': ['kn', 'en|kn', 'kannada'],
                    'ml': ['ml', 'en|ml', 'malayalam'],
                    'hi': ['hi', 'en|hi', 'hindi'],
                    'ta': ['ta', 'en|ta', 'tamil'],
                    'te': ['te', 'en|te', 'telugu'],
                    'mr': ['mr', 'en|mr', 'marathi'],
                    'gu': ['gu', 'en|gu', 'gujarati'],
                    'bn': ['bn', 'en|bn', 'bengali'],
                    'pa': ['pa', 'en|pa', 'punjabi'],
                    'ur': ['ur', 'en|ur', 'urdu']
                };
                
                // Get possible values for this language
                const possibleValues = languageMapping[targetLanguage] || [`en|${targetLanguage}`, targetLanguage];
                
                // Try exact matches first
                for (let possibleValue of possibleValues) {
                    for (let option of selectElement.options) {
                        if (option.value === possibleValue) {
                            console.log(`Found exact match: ${option.value} for ${targetLanguage}`);
                            selectElement.value = option.value;
                            
                            // Trigger multiple events for better compatibility
                            const events = ['change', 'click', 'input'];
                            events.forEach(eventType => {
                                const event = new Event(eventType, { bubbles: true, cancelable: true });
                                selectElement.dispatchEvent(event);
                            });
                            
                            // Verify the selection took effect
                            setTimeout(() => {
                                console.log(`Translation applied - Selected value: ${selectElement.value}`);
                                if (selectElement.value !== option.value) {
                                    console.warn('Translation selection may have failed - value mismatch');
                                }
                            }, 500);
                            
                            console.log(`Translation triggered: English to ${this.supportedLanguages[targetLanguage]}`);
                            return true;
                        }
                    }
                }
                
                // If no exact match, try partial matching (but be careful to avoid Arabic 'ar' confusion)
                for (let option of selectElement.options) {
                    const optionValue = option.value.toLowerCase();
                    if (optionValue.includes(targetLanguage) && !optionValue.includes('ar') && targetLanguage !== 'ar') {
                        console.log(`Found partial match: ${option.value} for ${targetLanguage}`);
                        selectElement.value = option.value;
                        
                        const events = ['change', 'click', 'input'];
                        events.forEach(eventType => {
                            const event = new Event(eventType, { bubbles: true, cancelable: true });
                            selectElement.dispatchEvent(event);
                        });
                        
                        console.log(`Translation triggered (partial match): English to ${this.supportedLanguages[targetLanguage]}`);
                        return true;
                    }
                }
                
                console.warn(`No matching option found for language: ${targetLanguage}`);
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
        
        // Try reinitializing the widget first for faster translation
        this.quickReinitialize(targetLanguage);
    }

    // Quick widget reinitialization
    quickReinitialize(targetLanguage) {
        try {
            console.log(`Quick reinitializing widget for ${targetLanguage}...`);
            
            // Clear and reinitialize widget quickly
            const widgetContainer = document.getElementById('google_translate_element');
            if (widgetContainer && window.google && window.google.translate) {
                widgetContainer.innerHTML = '';
                
                setTimeout(() => {
                    new window.google.translate.TranslateElement({
                        pageLanguage: 'en', // Always translate FROM English
                        includedLanguages: Object.keys(this.supportedLanguages).join(','),
                        layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL,
                        autoDisplay: false,
                        multilanguagePage: false // Ensure direct translation
                    }, 'google_translate_element');
                    
                    // Try translation again after reinit with faster attempts
                    this.retryWidgetTranslation(targetLanguage, 4);
                }, 100);
            } else {
                console.log('Widget container or Google Translate not available, falling back to page reload');
                localStorage.setItem('pending_translation', targetLanguage);
                window.location.reload();
            }
        } catch (error) {
            console.error('Quick reinitialize failed:', error);
            // Fallback to page reload for reliability
            localStorage.setItem('pending_translation', targetLanguage);
            window.location.reload();
        }
    }

    // Retry widget translation with multiple attempts
    retryWidgetTranslation(targetLanguage, maxAttempts) {
        let attempts = 0;
        
        const tryTranslation = () => {
            attempts++;
            console.log(`Translation attempt ${attempts}/${maxAttempts} for ${targetLanguage}`);
            
            if (this.tryWidgetTranslation(targetLanguage)) {
                console.log(`Translation successful on attempt ${attempts}`);
                this.showTranslationLoading(false);
                this.isTranslating = false;
                return;
            }
            
            if (attempts < maxAttempts) {
                // Much faster intervals for widget retry
                const delay = attempts <= 2 ? 200 : attempts <= 4 ? 400 : 600;
                setTimeout(tryTranslation, delay);
            } else {
                console.log('All translation attempts failed, using page reload as fallback');
                localStorage.setItem('pending_translation', targetLanguage);
                window.location.reload();
            }
        };
        
        // Start immediately - no initial delay
        tryTranslation();
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

    // Verify correct language translation (prevent Arabic confusion)
    verifyLanguageTranslation(expectedLanguage) {
        setTimeout(() => {
            const selectElement = document.querySelector('.goog-te-combo');
            if (selectElement) {
                const currentValue = selectElement.value;
                console.log(`Translation verification - Expected: ${expectedLanguage}, Current: ${currentValue}`);
                
                // Check if we accidentally got Arabic when expecting an Indian language
                if (expectedLanguage !== 'ar' && currentValue.includes('ar')) {
                    console.warn('Detected Arabic language when expecting different language - attempting correction...');
                    this.correctLanguageMismatch(expectedLanguage);
                }
            }
        }, 1000);
    }

    // Correct language mismatch (especially Arabic confusion)
    correctLanguageMismatch(correctLanguage) {
        console.log(`Correcting language mismatch to: ${correctLanguage}`);
        
        // Force clear any existing translation
        this.clearExistingTranslation();
        
        // Wait a moment then retry translation
        setTimeout(() => {
            this.tryWidgetTranslation(correctLanguage);
        }, 500);
    }

    // Force English only - comprehensive reset to English
    forceEnglishOnly() {
        console.log('Forcing English-only display...');
        
        this.showTranslationLoading(true);
        
        // Clear cache first
        this.clearCache();
        
        // Remove any pending translations
        localStorage.removeItem('pending_translation');
        
        // Try multiple methods to ensure English display
        this.attemptEnglishReset();
    }

    // Attempt comprehensive English reset
    attemptEnglishReset() {
        let resetSuccess = false;
        
        // Method 1: Try widget reset to original language
        try {
            const selectElement = document.querySelector('.goog-te-combo');
            if (selectElement) {
                console.log('Resetting Google Translate widget to original language...');
                selectElement.value = '';
                selectElement.selectedIndex = 0;
                
                // Trigger reset events
                const events = ['change', 'click', 'input', 'focus', 'blur'];
                events.forEach(eventType => {
                    const event = new Event(eventType, { bubbles: true, cancelable: true });
                    selectElement.dispatchEvent(event);
                });
                
                resetSuccess = true;
            }
        } catch (error) {
            console.log('Widget reset method failed:', error);
        }

        // Method 2: Clear all translation-related DOM elements
        this.clearAllTranslationElements();

        // Method 3: Force DOM cleanup
        this.forceEnglishDOM();

        // Method 4: If all else fails, reload with English
        setTimeout(() => {
            if (!this.verifyEnglishState()) {
                console.log('English reset verification failed - using page reload...');
                localStorage.setItem('force_english_reload', 'true');
                window.location.reload();
            } else {
                console.log('English reset successful');
                this.showTranslationLoading(false);
            }
        }, 1500);
    }

    // Clear all translation-related DOM elements
    clearAllTranslationElements() {
        try {
            // Remove all Google Translate elements
            const gtElements = document.querySelectorAll(
                '[id^="goog-gt-"], .goog-te-balloon-frame, .goog-te-menu-frame, ' +
                '.goog-te-banner-frame, .goog-te-ftab, [class*="goog-te"]'
            );
            gtElements.forEach(el => {
                if (el.parentNode && el.id !== 'google_translate_element') {
                    el.parentNode.removeChild(el);
                }
            });

            // Reset body classes
            document.body.className = document.body.className
                .replace(/goog-te-\S+/g, '')
                .replace(/translated-\S+/g, '')
                .trim();

            // Remove translation styling
            document.querySelectorAll('style[id*="goog"], link[href*="translate"]').forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });

            console.log('Cleared all translation DOM elements');
        } catch (error) {
            console.error('Error clearing translation elements:', error);
        }
    }

    // Force DOM to English state
    forceEnglishDOM() {
        try {
            // Reset any translated text nodes back to original
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.parentNode && 
                    !node.parentNode.classList.contains('notranslate') &&
                    node.nodeValue.trim().length > 0) {
                    textNodes.push(node);
                }
            }

            // Remove any font styling added by Google Translate
            document.querySelectorAll('[style*="font"]').forEach(el => {
                if (el.style.cssText.includes('font-family')) {
                    el.style.removeProperty('font-family');
                    el.style.removeProperty('font-size');
                }
            });

            // Reset any direction changes
            document.querySelectorAll('[dir]').forEach(el => {
                if (el !== document.documentElement) {
                    el.removeAttribute('dir');
                }
            });

            console.log('Forced DOM to English state');
        } catch (error) {
            console.error('Error forcing English DOM:', error);
        }
    }

    // Verify that we're in English state
    verifyEnglishState() {
        const hasTranslatedClass = document.body.classList.contains('goog-te-translated');
        const selectElement = document.querySelector('.goog-te-combo');
        const hasActiveTranslation = selectElement && selectElement.value && selectElement.value !== '';

        const isEnglish = !hasTranslatedClass && !hasActiveTranslation;
        
        console.log('English state verification:', {
            hasTranslatedClass,
            hasActiveTranslation,
            isEnglish
        });

        return isEnglish;
    }

    // Block all translations and ensure English only
    blockAllTranslations() {
        console.log('Blocking all translations to ensure English display');
        
        // Prevent Google Translate from loading
        window.googleTranslateElementInit = function() {
            console.log('Google Translate blocked - English mode');
        };
        
        // Remove any existing Google Translate elements
        this.removeAllGoogleTranslateElements();
        
        // Add CSS to hide any translation elements that might appear
        this.addEnglishOnlyStyles();
        
        // Disable translation methods
        this.useGoogleWidget = false;
        
        // Monitor for any translation attempts and block them
        this.monitorAndBlockTranslations();
    }

    // Remove all Google Translate elements completely
    removeAllGoogleTranslateElements() {
        // Remove all Google Translate related elements
        const selectors = [
            '[id^="goog-gt-"]', 
            '.goog-te-balloon-frame', 
            '.goog-te-menu-frame',
            '.goog-te-banner-frame', 
            '.goog-te-ftab',
            '[class*="goog-te"]',
            '#google_translate_element'
        ];
        
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        });

        // Remove Google Translate scripts
        document.querySelectorAll('script[src*="translate.google"]').forEach(script => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        });

        // Reset body classes
        document.body.className = document.body.className
            .replace(/goog-te-\S+/g, '')
            .replace(/translated-\S+/g, '')
            .trim();
    }

    // Add styles to ensure English only display
    addEnglishOnlyStyles() {
        const styleId = 'english-only-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Hide any Google Translate elements */
            [id^="goog-gt-"],
            .goog-te-balloon-frame,
            .goog-te-menu-frame,
            .goog-te-banner-frame,
            .goog-te-ftab,
            [class*="goog-te"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
            
            /* Ensure body is never translated */
            body {
                top: 0px !important;
            }
            
            /* Prevent translation styling */
            * {
                font-family: inherit !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Monitor and block any translation attempts
    monitorAndBlockTranslations() {
        // Block any new Google Translate script injections
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Remove any Google Translate elements that get added
                        if (node.id && node.id.includes('goog')) {
                            node.remove();
                        }
                        if (node.className && node.className.includes && node.className.includes('goog-te')) {
                            node.remove();
                        }
                        // Remove any Google Translate scripts
                        if (node.tagName === 'SCRIPT' && node.src && node.src.includes('translate.google')) {
                            node.remove();
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('Translation monitoring active - will block any translation attempts');
    }

    // Re-enable widget functionality when switching from English mode to translation
    reEnableWidgetFromEnglishMode(targetLanguage) {
        console.log(`Re-enabling translation widget for ${targetLanguage}`);
        
        // Remove English-only blocking styles
        const englishOnlyStyles = document.getElementById('english-only-styles');
        if (englishOnlyStyles) {
            englishOnlyStyles.remove();
        }
        
        // Re-enable widget functionality
        this.useGoogleWidget = true;
        
        // Clear any English-only state
        this.removeAllGoogleTranslateElements();
        
        // Re-initialize the translation system
        this.reinitializeForTranslation(targetLanguage);
    }

    // Reinitialize the translation system from English mode
    reinitializeForTranslation(targetLanguage) {
        console.log(`Reinitializing translation system for ${targetLanguage}`);
        
        // Clear cache and state
        this.clearCache();
        
        // Recreate the Google Translate widget container
        const widgetContainer = document.getElementById('google_translate_element');
        if (!widgetContainer) {
            const newContainer = document.createElement('div');
            newContainer.id = 'google_translate_element';
            newContainer.style.display = 'none';
            document.body.appendChild(newContainer);
        }
        
        // Load Google Translate widget if not already loaded
        if (!window.google || !window.google.translate) {
            this.loadGoogleTranslateWidget();
            
            // Much faster widget loading - check more frequently
            this.waitForWidgetAndTranslate(targetLanguage, 10, 150);
        } else {
            // Widget already available, initialize and translate immediately
            this.initializeWidget();
            
            setTimeout(() => {
                this.currentLanguage = targetLanguage;
                this.saveLanguagePreference(targetLanguage);
                this.updateLanguageDisplay();
                this.translatePageWithWidget(targetLanguage);
            }, 300); // Reduced from 1000ms to 300ms
        }
    }

    // Wait for widget to load with faster checking
    waitForWidgetAndTranslate(targetLanguage, maxChecks, interval) {
        let checks = 0;
        
        const checkWidget = () => {
            checks++;
            
            if (window.google && window.google.translate) {
                console.log(`Widget ready after ${checks} checks`);
                this.currentLanguage = targetLanguage;
                this.saveLanguagePreference(targetLanguage);
                this.updateLanguageDisplay();
                this.translatePageWithWidget(targetLanguage);
                return;
            }
            
            if (checks < maxChecks) {
                setTimeout(checkWidget, interval);
            } else {
                console.log('Widget loading timeout, falling back to page reload');
                localStorage.setItem('pending_translation', targetLanguage);
                window.location.reload();
            }
        };
        
                 checkWidget();
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
        
        // Check if forcing English
        const forceEnglish = localStorage.getItem('force_english_reload');
        
        if (forceEnglish || saved === 'en') {
            // Ensure English is properly set without translation
            console.log('Loading English preference - no translation needed');
            this.currentLanguage = 'en';
            this.updateLanguageDisplay();
        } else if (saved && this.supportedLanguages[saved]) {
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