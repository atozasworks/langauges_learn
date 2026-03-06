class GroqDialogueService {
    constructor() {
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.model = 'llama-3.3-70b-versatile';
        this.storageKey = 'groq_api_key';
        this.lastLocationKey = 'dialogue_last_location';
    }

    getApiKey() {
        return (localStorage.getItem(this.storageKey) || '').trim();
    }

    setApiKey(apiKey) {
        localStorage.setItem(this.storageKey, (apiKey || '').trim());
    }

    clearApiKey() {
        localStorage.removeItem(this.storageKey);
    }

    async ensureApiKey() {
        let apiKey = this.getApiKey();
        if (apiKey) return apiKey;

        const entered = window.prompt('Enter your Groq API key to generate dialogues on the spot:');
        if (!entered || !entered.trim()) {
            throw new Error('Groq API key is required to generate dynamic dialogues.');
        }

        apiKey = entered.trim();
        this.setApiKey(apiKey);
        return apiKey;
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
        const buildPayload = (strictMode = false) => {
            const systemPrompt = [
            'You are an expert language-learning dialogue writer.',
            'Return ONLY valid minified JSON with no markdown, no comments, no extra text.',
            'Output schema: {"conversations":[{"title":"...","lines":["...16 lines..."]}]}',
            'Rules:',
            '- Exactly 25 conversations.',
            '- Category for ALL conversations: comedy dialogues.',
            '- Each conversation must contain exactly 16 short, natural sentences.',
            '- Sentences must represent a realistic real-life situation in the provided geographic location.',
            '- Tone must be clearly funny, playful, and suitable for language learners.',
            '- Every conversation must include at least one comic misunderstanding, one playful exaggeration, and one light punchline.',
            '- Avoid neutral or serious tone.',
            '- Keep content safe, practical, and culturally appropriate.',
            '- Language of all titles and lines must be the requested target language.',
            '- Do not add speaker labels in the lines.'
            ];

            if (strictMode) {
                systemPrompt.push(
                    '- STRICT MODE: Reject serious, formal, or neutral content.',
                    '- STRICT MODE: If any conversation sounds serious, rewrite it with humor before final output.'
                );
            }

            const userPrompt = [
                `Target language name: ${languageName}`,
                `Target language code: ${languageCode}`,
                `Learning level: ${level}`,
                `Geographic location focus: ${locationLabel}`,
                'Conversation category: Comedy dialogues.',
                'Create conversations that help learners speak in everyday local scenarios (transport, market, clinic, office, school, food, travel, emergencies, neighborhood, social situations, services), and keep every conversation comedic.',
                'Each line must be one sentence and easy to read for the selected level.'
            ];

            if (strictMode) {
                userPrompt.push('Do not produce serious conversations. Keep humor obvious throughout all 25 conversations.');
            }

            return {
                model: this.model,
                temperature: strictMode ? 0.95 : 0.8,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemPrompt.join('\n') },
                    { role: 'user', content: userPrompt.join('\n') }
                ]
            };
        };

        const payload = buildPayload(false);

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
        let normalized = this.normalizeConversations(parsed?.conversations || []);

        const context = {
            languageName,
            languageCode,
            level,
            locationLabel
        };

        let humorCheck = await this.validateComedyQuality(activeApiKey, normalized, context);

        if (!humorCheck.isAllFunny) {
            normalized = await this.rewriteNonFunnyConversations(activeApiKey, normalized, humorCheck.notFunnyIndexes, context);
            humorCheck = await this.validateComedyQuality(activeApiKey, normalized, context);
        }

        if (!humorCheck.isAllFunny) {
            const strictPayload = buildPayload(true);
            const strictData = await this.requestGroqCompletion(activeApiKey, strictPayload);
            const strictContent = strictData?.choices?.[0]?.message?.content;
            if (strictContent) {
                const strictParsed = this.parseGeneratedContent(strictContent);
                normalized = this.normalizeConversations(strictParsed?.conversations || []);

                const strictCheck = await this.validateComedyQuality(activeApiKey, normalized, context);
                if (!strictCheck.isAllFunny) {
                    normalized = await this.rewriteNonFunnyConversations(activeApiKey, normalized, strictCheck.notFunnyIndexes, context);
                }
            }
        }

        return normalized;
    }

    async validateComedyQuality(apiKey, conversations, context) {
        try {
            const validatorPayload = {
                model: this.model,
                temperature: 0,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: [
                            'You are a strict comedy validator for language-learning dialogues.',
                            'Return ONLY valid JSON with this schema:',
                            '{"isAllFunny":true|false,"notFunnyIndexes":[0-based indexes]}.',
                            'Mark a conversation as not funny if it is serious, formal, neutral, or lacks obvious humor.',
                            'isAllFunny must be true only when all 25 conversations are clearly funny.'
                        ].join('\n')
                    },
                    {
                        role: 'user',
                        content: [
                            `Language: ${context.languageName} (${context.languageCode})`,
                            `Level: ${context.level}`,
                            `Location focus: ${context.locationLabel}`,
                            'Check whether these 25 conversations are clearly comedic overall:',
                            JSON.stringify({ conversations })
                        ].join('\n')
                    }
                ]
            };

            const validation = await this.requestGroqCompletion(apiKey, validatorPayload);
            const content = validation?.choices?.[0]?.message?.content;
            if (!content) {
                return { isAllFunny: false, notFunnyIndexes: conversations.map((_, index) => index) };
            }

            const parsed = this.parseGeneratedContent(content);
            const notFunnyIndexes = Array.isArray(parsed?.notFunnyIndexes)
                ? parsed.notFunnyIndexes
                    .map(index => Number(index))
                    .filter(index => Number.isInteger(index) && index >= 0 && index < conversations.length)
                : [];

            const isAllFunny = Boolean(parsed?.isAllFunny) && notFunnyIndexes.length === 0;
            return {
                isAllFunny,
                notFunnyIndexes: isAllFunny ? [] : (notFunnyIndexes.length > 0 ? notFunnyIndexes : conversations.map((_, index) => index))
            };
        } catch (error) {
            console.warn('Comedy validation failed, treating all conversations as needing rewrite.', error);
            return { isAllFunny: false, notFunnyIndexes: conversations.map((_, index) => index) };
        }
    }

    async rewriteNonFunnyConversations(apiKey, conversations, notFunnyIndexes, context) {
        const indexesToRewrite = Array.isArray(notFunnyIndexes) && notFunnyIndexes.length > 0
            ? [...new Set(notFunnyIndexes)]
            : conversations.map((_, index) => index);

        const selected = indexesToRewrite.map(index => ({
            index,
            title: conversations[index]?.title || `Comedy Conversation ${index + 1}`,
            lines: Array.isArray(conversations[index]?.lines) ? conversations[index].lines.slice(0, 16) : []
        }));

        const rewritePayload = {
            model: this.model,
            temperature: 0.9,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: [
                        'You rewrite dialogues to be clearly funny while preserving language-learning clarity.',
                        'Return ONLY valid minified JSON: {"conversations":[{"index":0,"title":"...","lines":["16 lines"]}]}',
                        'Rules:',
                        '- Rewrite only the provided conversations.',
                        '- Keep the same index for each rewritten conversation.',
                        '- Each rewritten conversation must have exactly 16 short lines.',
                        '- Humor must be obvious and light in every rewritten conversation.',
                        '- Use everyday real-life situations only.',
                        '- Keep content safe and culturally appropriate.',
                        '- Do not include speaker labels in lines.'
                    ].join('\n')
                },
                {
                    role: 'user',
                    content: [
                        `Language: ${context.languageName} (${context.languageCode})`,
                        `Level: ${context.level}`,
                        `Location focus: ${context.locationLabel}`,
                        'Rewrite these conversations to be clearly funny:',
                        JSON.stringify({ conversations: selected })
                    ].join('\n')
                }
            ]
        };

        try {
            const rewriteResponse = await this.requestGroqCompletion(apiKey, rewritePayload);
            const content = rewriteResponse?.choices?.[0]?.message?.content;
            if (!content) {
                return conversations;
            }

            const parsed = this.parseGeneratedContent(content);
            const rewrites = Array.isArray(parsed?.conversations) ? parsed.conversations : [];
            const updated = conversations.map(conversation => ({ ...conversation, lines: [...conversation.lines] }));

            rewrites.forEach((item) => {
                const index = Number(item?.index);
                if (!Number.isInteger(index) || index < 0 || index >= updated.length) return;

                const title = String(item?.title || updated[index].title || `Comedy Conversation ${index + 1}`).trim();
                const sourceLines = Array.isArray(item?.lines) ? item.lines : [];
                const cleaned = sourceLines
                    .map(line => String(line || '').trim())
                    .filter(Boolean)
                    .map(line => line.replace(/^\d+[\.)-]\s*/, '').trim());

                const lines = cleaned.slice(0, 16);
                while (lines.length < 16) {
                    lines.push('That punchline slipped, so let us try this comedy line again.');
                }

                updated[index] = {
                    title: title || `Comedy Conversation ${index + 1}`,
                    lines
                };
            });

            return updated;
        } catch (error) {
            console.warn('Failed to rewrite non-funny conversations.', error);
            return conversations;
        }
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
                lines.push('That was too serious, so let us continue this comedy conversation with a smile.');
            }

            return { title, lines };
        });

        while (normalized.length < 25) {
            const i = normalized.length + 1;
            normalized.push({
                title: `Real-Life Situation ${i}`,
                lines: Array.from({ length: 16 }, () => 'That was too serious, so let us continue this comedy conversation with a smile.')
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
