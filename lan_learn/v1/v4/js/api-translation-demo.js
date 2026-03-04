// Google Translate API Demo (Premium Features)
// This file demonstrates how to use Google Translate API with an API key
// for more advanced translation features and better control.

class APITranslationDemo {
    constructor() {
        this.apiKey = null; // Set your Google Translate API key here
        this.apiUrl = 'https://translation.googleapis.com/language/translate/v2';
        this.cache = new Map();
    }

    // Set your Google Translate API key
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        console.log('Google Translate API key set');
    }

    // Check if API key is configured
    isApiConfigured() {
        return this.apiKey && this.apiKey.trim() !== '';
    }

    // Translate text using Google Translate API
    async translateText(text, targetLanguage, sourceLanguage = 'en') {
        if (!this.isApiConfigured()) {
            throw new Error('Google Translate API key not configured');
        }

        // Check cache first
        const cacheKey = `${sourceLanguage}-${targetLanguage}-${text}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
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
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const translatedText = data.data.translations[0].translatedText;
            
            // Cache the translation
            this.cache.set(cacheKey, translatedText);
            
            return translatedText;
        } catch (error) {
            console.error('Translation failed:', error);
            throw error;
        }
    }

    // Translate dialogue content in batches
    async translateDialogue(dialogueText, targetLanguage, sourceLanguage = 'en') {
        if (!dialogueText || targetLanguage === sourceLanguage) {
            return dialogueText;
        }

        const lines = dialogueText.split('\n');
        const translatedLines = [];
        const batchSize = 10; // Translate in batches to respect API limits

        for (let i = 0; i < lines.length; i += batchSize) {
            const batch = lines.slice(i, i + batchSize);
            const batchPromises = batch.map(async (line) => {
                if (line.trim() === '' || line.includes('Conversation ') || line.includes('Basic Introduction')) {
                    return line; // Don't translate empty lines or headers
                }

                try {
                    return await this.translateText(line, targetLanguage, sourceLanguage);
                } catch (error) {
                    console.error(`Failed to translate line: ${line}`, error);
                    return line; // Return original line if translation fails
                }
            });

            const batchResults = await Promise.all(batchPromises);
            translatedLines.push(...batchResults);

            // Add a small delay between batches to respect rate limits
            if (i + batchSize < lines.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return translatedLines.join('\n');
    }

    // Detect language of text
    async detectLanguage(text) {
        if (!this.isApiConfigured()) {
            throw new Error('Google Translate API key not configured');
        }

        try {
            const response = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text
                })
            });

            if (!response.ok) {
                throw new Error(`Detection failed: ${response.status}`);
            }

            const data = await response.json();
            return data.data.detections[0][0];
        } catch (error) {
            console.error('Language detection failed:', error);
            throw error;
        }
    }

    // Get supported languages
    async getSupportedLanguages() {
        if (!this.isApiConfigured()) {
            throw new Error('Google Translate API key not configured');
        }

        try {
            const response = await fetch(`https://translation.googleapis.com/language/translate/v2/languages?key=${this.apiKey}&target=en`);
            
            if (!response.ok) {
                throw new Error(`Failed to get languages: ${response.status}`);
            }

            const data = await response.json();
            return data.data.languages;
        } catch (error) {
            console.error('Failed to get supported languages:', error);
            throw error;
        }
    }

    // Clear translation cache
    clearCache() {
        this.cache.clear();
        console.log('Translation cache cleared');
    }

    // Get usage statistics
    getUsageStats() {
        return {
            cachedTranslations: this.cache.size,
            apiConfigured: this.isApiConfigured()
        };
    }
}

// Usage Example:
/*
// Initialize the API translation service
const apiTranslation = new APITranslationDemo();

// Set your Google Translate API key (get one from Google Cloud Console)
apiTranslation.setApiKey('YOUR_GOOGLE_TRANSLATE_API_KEY_HERE');

// Translate text
apiTranslation.translateText('Hello, world!', 'es')
    .then(translated => console.log('Translated:', translated))
    .catch(error => console.error('Translation error:', error));

// Translate dialogue
const dialogue = "John: Hello, how are you?\nMary: I'm fine, thank you!";
apiTranslation.translateDialogue(dialogue, 'fr')
    .then(translated => console.log('Translated dialogue:', translated))
    .catch(error => console.error('Translation error:', error));

// Detect language
apiTranslation.detectLanguage('Bonjour le monde')
    .then(detection => console.log('Detected language:', detection))
    .catch(error => console.error('Detection error:', error));
*/

// How to get a Google Translate API key:
/*
1. Go to Google Cloud Console (https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Translate API
4. Go to Credentials and create an API key
5. Optionally, restrict the API key to specific APIs and IP addresses
6. Copy the API key and use it in your application

Note: Google Translate API is a paid service with free tier limits.
Check the pricing at: https://cloud.google.com/translate/pricing
*/

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APITranslationDemo;
} 