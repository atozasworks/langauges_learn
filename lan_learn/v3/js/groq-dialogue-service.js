class GroqDialogueService {
    constructor() {
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.model = 'llama-3.3-70b-versatile';
        this.storageKey = 'groq_api_key';
        this.lastLocationKey = 'dialogue_last_location';
        this._cachedApiKey = null;
    }

    getApiKey() {
        return this._cachedApiKey || localStorage.getItem(this.storageKey) || '';
    }

    setApiKey(apiKey) {
        this._cachedApiKey = (apiKey || '').trim();
        localStorage.setItem(this.storageKey, this._cachedApiKey);
    }

    clearApiKey() {
        this._cachedApiKey = null;
        localStorage.removeItem(this.storageKey);
    }

    async ensureApiKey() {
        // Return cached key if available
        if (this._cachedApiKey) return this._cachedApiKey;

        // Try fetching from server-side .env via PHP endpoint
        try {
            const resp = await fetch('/auth-backend/get-groq-key.php');
            if (resp.ok) {
                const data = await resp.json();
                if (data.key) {
                    this._cachedApiKey = data.key;
                    return this._cachedApiKey;
                }
            }
        } catch (e) {
            console.warn('Could not fetch Groq API key from server:', e.message);
        }

        // Fallback: check localStorage
        const stored = (localStorage.getItem(this.storageKey) || '').trim();
        if (stored) {
            this._cachedApiKey = stored;
            return stored;
        }

        throw new Error('Groq API key is not configured. Please set GROQ_API_KEY in the .env file.');
    }

    async getLocationContext(preferences = {}) {
        const mode = preferences.locationMode || 'auto';

        if (mode === 'manual') {
            return this.getManualLocation();
        }

        const useCurrent = await this.showLocationModePopup();
        if (!useCurrent) {
            return this.getManualLocation();
        }

        try {
            const position = await this.getCurrentPosition();
            const reverse = await this.reverseGeocode(position.coords.latitude, position.coords.longitude);

            const locationLabel = reverse || `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
            localStorage.setItem(this.lastLocationKey, locationLabel);

            return {
                source: 'current-location',
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                locationLabel
            };
        } catch (error) {
            await this.showMessagePopup('Current location is unavailable. Please enable location access or enter a location manually.');
            return this.getManualLocation();
        }
    }

    getManualLocation() {
        const lastLocation = localStorage.getItem(this.lastLocationKey) || '';
        const enteredLocation = window.prompt(
            'Enter city/region/country for generating relevant dialogues:',
            lastLocation
        );

        if (!enteredLocation || !enteredLocation.trim()) {
            throw new Error('A geographic location is required to generate suitable dialogues.');
        }

        const locationLabel = enteredLocation.trim();
        localStorage.setItem(this.lastLocationKey, locationLabel);

        return {
            source: 'manual',
            locationLabel
        };
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            });
        });
    }

    async reverseGeocode(latitude, longitude) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) return '';
            const data = await response.json();

            if (!data || !data.address) {
                return data?.display_name || '';
            }

            const address = data.address;
            const city = address.city || address.town || address.village || address.county || '';
            const state = address.state || '';
            const country = address.country || '';

            return [city, state, country].filter(Boolean).join(', ') || data.display_name || '';
        } catch (error) {
            console.warn('Reverse geocoding failed:', error);
            return '';
        }
    }

    async generateDialogues({
        apiKey,
        level,
        languageName,
        languageCode,
        locationLabel
    }) {
        const systemPrompt = [
            'You are an expert language-learning dialogue writer.',
            'Return ONLY valid minified JSON with no markdown, no comments, no extra text.',
            'Output schema: {"conversations":[{"title":"...","lines":["...16 lines..."]}]}',
            'Rules:',
            '- Exactly 25 conversations.',
            '- Each conversation must contain exactly 16 short, natural sentences.',
            '- Sentences must represent a realistic real-life situation in the provided geographic location.',
            '- Keep content safe, practical, and culturally appropriate.',
            '- Language of all titles and lines must be the requested target language.',
            '- Do not add speaker labels in the lines.'
        ].join('\n');

        const userPrompt = [
            `Target language name: ${languageName}`,
            `Target language code: ${languageCode}`,
            `Learning level: ${level}`,
            `Geographic location focus: ${locationLabel}`,
            'Create conversations that help learners speak in everyday local scenarios (transport, market, clinic, office, school, food, travel, emergencies, neighborhood, social situations, services).',
            'Each line must be one sentence and easy to read for the selected level.'
        ].join('\n');

        const payload = {
            model: this.model,
            temperature: 0.7,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        };

        let activeApiKey = (apiKey || '').trim();
        if (!activeApiKey) {
            activeApiKey = await this.ensureApiKey();
        }

        let data = await this.requestGroqCompletion(activeApiKey, payload);

        // Retry once if API key is invalid
        if (data?.__invalidApiKey) {
            this.clearApiKey();
            await this.showMessagePopup('Stored Groq API key is invalid. Please enter a valid key.');
            const refreshedApiKey = await this.ensureApiKey();
            data = await this.requestGroqCompletion(refreshedApiKey, payload);
            if (data?.__invalidApiKey) {
                this.clearApiKey();
                throw new Error('Groq API key is invalid. Please update your API key and try again.');
            }
        }

        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Groq response did not include generated content.');
        }

        const parsed = this.parseGeneratedContent(content);
        return this.normalizeConversations(parsed?.conversations || []);
    }

    async requestGroqCompletion(apiKey, payload) {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            if (this.isInvalidApiKeyError(response.status, errText)) {
                return { __invalidApiKey: true };
            }
            throw new Error(`Groq API request failed (${response.status}): ${errText}`);
        }

        return response.json();
    }

    isInvalidApiKeyError(status, errorText) {
        if (status !== 401) {
            return false;
        }

        const text = String(errorText || '').toLowerCase();
        return text.includes('invalid_api_key') || text.includes('invalid api key');
    }

    showLocationModePopup() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'popup-overlay show';

            const content = document.createElement('div');
            content.className = 'popup-content';

            const message = document.createElement('p');
            message.textContent = 'Use current location for location-based dialogues? Click Cancel to enter location manually.';

            const buttons = document.createElement('div');
            buttons.className = 'popup-buttons';

            const okButton = document.createElement('button');
            okButton.className = 'popup-btn';
            okButton.textContent = 'OK';

            const cancelButton = document.createElement('button');
            cancelButton.className = 'popup-btn cancel-btn';
            cancelButton.textContent = 'Cancel';

            const cleanup = (value) => {
                overlay.remove();
                resolve(value);
            };

            okButton.addEventListener('click', () => cleanup(true));
            cancelButton.addEventListener('click', () => cleanup(false));

            buttons.appendChild(okButton);
            buttons.appendChild(cancelButton);
            content.appendChild(message);
            content.appendChild(buttons);
            overlay.appendChild(content);
            document.body.appendChild(overlay);
        });
    }

    showMessagePopup(messageText) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'popup-overlay show';

            const content = document.createElement('div');
            content.className = 'popup-content';

            const message = document.createElement('p');
            message.textContent = messageText;

            const okButton = document.createElement('button');
            okButton.className = 'popup-btn';
            okButton.textContent = 'OK';

            okButton.addEventListener('click', () => {
                overlay.remove();
                resolve();
            });

            content.appendChild(message);
            content.appendChild(okButton);
            overlay.appendChild(content);
            document.body.appendChild(overlay);
        });
    }

    parseGeneratedContent(content) {
        try {
            return JSON.parse(content);
        } catch (error) {
            const match = String(content).match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
            throw new Error('Unable to parse Groq JSON response.');
        }
    }

    normalizeConversations(conversations) {
        if (!Array.isArray(conversations) || conversations.length === 0) {
            throw new Error('No conversations were returned by Groq.');
        }

        const normalized = conversations.slice(0, 25).map((conversation, index) => {
            const rawTitle = (conversation?.title || `Real-Life Situation ${index + 1}`).toString().trim();
            const title = rawTitle || `Real-Life Situation ${index + 1}`;
            const sourceLines = Array.isArray(conversation?.lines) ? conversation.lines : [];
            const cleaned = sourceLines
                .map(line => String(line || '').trim())
                .filter(Boolean)
                .map(line => line.replace(/^\d+[\.)-]\s*/, '').trim());

            const lines = cleaned.slice(0, 16);
            while (lines.length < 16) {
                lines.push('Please continue practicing this real-life conversation.');
            }

            return { title, lines };
        });

        while (normalized.length < 25) {
            const i = normalized.length + 1;
            normalized.push({
                title: `Real-Life Situation ${i}`,
                lines: Array.from({ length: 16 }, () => 'Please continue practicing this real-life conversation.')
            });
        }

        return normalized;
    }

    toDialogueText(conversations) {
        return conversations.map((conversation, index) => {
            const lines = conversation.lines
                .slice(0, 16)
                .map((line, lineIndex) => `Speaker ${lineIndex + 1}: ${line}`)
                .join('\n');

            return `Conversation ${index + 1}\n${conversation.title}\n${lines}`;
        }).join('\n\n');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GroqDialogueService;
}
