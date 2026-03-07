class GroqDialogueService {
    constructor() {
        this.apiUrl = 'https://api.deepseek.com/chat/completions';
        this.model = 'deepseek-chat';
        this.storageKey = 'deepseek_api_key';
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

        const entered = window.prompt('Enter your DeepSeek API key to generate dialogues on the spot:');
        if (!entered || !entered.trim()) {
            throw new Error('DeepSeek API key is required to generate dynamic dialogues.');
        }

        apiKey = entered.trim();
        this.setApiKey(apiKey);
        return apiKey;
    }

    async getLocationContext(preferences = {}) {
        const providedLocation = String(preferences.geographicLocation || preferences.manualLocation || '').trim();
        if (providedLocation) {
            localStorage.setItem(this.lastLocationKey, providedLocation);
            return {
                source: 'manual-entry',
                locationLabel: providedLocation
            };
        }

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
        locationLabel,
        category
    }) {
        const normalizedCategory = this.normalizeCategory(category);
        const categoryBehavior = this.getCategoryBehavior(normalizedCategory);

        const buildPayload = (strictMode = false) => {
            const systemPrompt = [
            'You are an expert language-learning dialogue writer.',
            'Return ONLY valid minified JSON with no markdown, no comments, no extra text.',
            'Output schema: {"conversations":[{"title":"...","lines":["...16 lines..."]}]}',
            'Rules:',
            '- Exactly 25 conversations.',
            `- Conversation variant for ALL conversations: ${normalizedCategory}.`,
            '- Each conversation must contain exactly 16 short, natural sentences.',
            '- Sentences must represent a realistic real-life situation in the provided geographic location.',
            `- Tone must strongly match the selected conversation variant: ${normalizedCategory}.`,
            ...categoryBehavior.systemRules,
            '- Keep content safe, practical, and culturally appropriate.',
            '- Language of all titles and lines must be the requested target language.',
            '- Do not add speaker labels in the lines.',
            '- Keep sentences simple and useful for language learners.',
            '- End each conversation with a natural or engaging final line.'
            ];

            if (strictMode) {
                systemPrompt.push(
                    '- STRICT MODE: Reject off-category tone or mixed-category output.',
                    '- STRICT MODE: Ensure all 25 conversations strongly match the selected conversation variant before final output.'
                );
            }

            const userPrompt = [
                `Target language name: ${languageName}`,
                `Target language code: ${languageCode}`,
                `Learning level: ${level}`,
                `Geographic location focus: ${locationLabel}`,
                `Conversation variant: ${normalizedCategory}.`,
                'Create conversations that help learners speak in everyday local scenarios (transport, market, clinic, office, school, food, travel, emergencies, neighborhood, social situations, services).',
                ...categoryBehavior.userRules,
                'Each line must be one sentence and easy to read for the selected level.'
            ];

            if (strictMode) {
                userPrompt.push('Do not produce mixed tones. Keep all 25 conversations fully aligned with the selected conversation variant.');
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

        let data = await this.requestDeepSeekCompletion(activeApiKey, payload);

        // Retry once if API key is invalid
        if (data?.__invalidApiKey) {
            this.clearApiKey();
            await this.showMessagePopup('Stored DeepSeek API key is invalid. Please enter a valid key.');
            const refreshedApiKey = await this.ensureApiKey();
            data = await this.requestDeepSeekCompletion(refreshedApiKey, payload);
            if (data?.__invalidApiKey) {
                this.clearApiKey();
                throw new Error('DeepSeek API key is invalid. Please update your API key and try again.');
            }
        }

        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('DeepSeek response did not include generated content.');
        }

        const parsed = this.parseGeneratedContent(content);
        let normalized = this.normalizeConversations(parsed?.conversations || [], normalizedCategory);

        const context = {
            languageName,
            languageCode,
            level,
            locationLabel,
            category: normalizedCategory
        };

        let categoryCheck = await this.validateCategoryQuality(activeApiKey, normalized, context);

        if (!categoryCheck.isAllOnCategory) {
            normalized = await this.rewriteOffCategoryConversations(activeApiKey, normalized, categoryCheck.offCategoryIndexes, context);
            categoryCheck = await this.validateCategoryQuality(activeApiKey, normalized, context);
        }

        if (!categoryCheck.isAllOnCategory) {
            const strictPayload = buildPayload(true);
            const strictData = await this.requestDeepSeekCompletion(activeApiKey, strictPayload);
            const strictContent = strictData?.choices?.[0]?.message?.content;
            if (strictContent) {
                const strictParsed = this.parseGeneratedContent(strictContent);
                normalized = this.normalizeConversations(strictParsed?.conversations || [], normalizedCategory);

                const strictCheck = await this.validateCategoryQuality(activeApiKey, normalized, context);
                if (!strictCheck.isAllOnCategory) {
                    normalized = await this.rewriteOffCategoryConversations(activeApiKey, normalized, strictCheck.offCategoryIndexes, context);
                }
            }
        }

        return normalized;
    }

    normalizeCategory(category) {
        const normalized = String(category || '').trim().replace(/\s+/g, ' ');
        return normalized ? normalized.slice(0, 80) : 'funny dialogues';
    }

    getCategoryBehavior(category) {
        const normalized = this.normalizeCategory(category).toLowerCase();

        if (normalized === 'funny dialogues') {
            return {
                systemRules: [
                    '- Conversations must be humorous, playful, and include light jokes or misunderstandings.',
                    '- Avoid serious or formal tone.'
                ],
                userRules: [
                    'Include playful misunderstandings and light punchlines in each conversation.'
                ],
                validatorRule: 'Mark as off-category if a conversation is not clearly humorous or playful.',
                rewriteRule: 'Rewrites must be clearly funny and playful with light jokes.',
                fallbackLine: 'That joke was silly, but now we understand each other better.'
            };
        }

        if (normalized === 'angry dialogues') {
            return {
                systemRules: [
                    '- Conversations must show realistic frustration, arguments, or irritation without unsafe content.',
                    '- Keep conflict verbal and suitable for language learners.'
                ],
                userRules: [
                    'Show tense real-life disagreements while keeping language simple and safe.'
                ],
                validatorRule: 'Mark as off-category if frustration, argument, or irritation is not clearly present.',
                rewriteRule: 'Rewrites must clearly show realistic irritation or arguments while remaining safe.',
                fallbackLine: 'I am still upset, but we can solve this calmly now.'
            };
        }

        if (normalized === 'romantic dialogues') {
            return {
                systemRules: [
                    '- Conversations must feel warm, emotional, and affectionate.',
                    '- Keep tone respectful, gentle, and suitable for learners.'
                ],
                userRules: [
                    'Use affectionate and caring language in realistic daily situations.'
                ],
                validatorRule: 'Mark as off-category if warmth and affection are not clearly present.',
                rewriteRule: 'Rewrites must be emotionally warm and affectionate in a respectful way.',
                fallbackLine: 'I feel close to you, and this moment means a lot.'
            };
        }

        return {
            systemRules: [
                `- Conversations must strongly match this selected category: ${this.normalizeCategory(category)}.`
            ],
            userRules: [
                `Keep tone and word choice strongly aligned with: ${this.normalizeCategory(category)}.`
            ],
            validatorRule: `Mark as off-category if tone does not strongly match: ${this.normalizeCategory(category)}.`,
            rewriteRule: `Rewrites must strongly match this category: ${this.normalizeCategory(category)}.`,
            fallbackLine: 'That situation felt real, and now we know what to say next.'
        };
    }

    async validateCategoryQuality(apiKey, conversations, context) {
        const categoryBehavior = this.getCategoryBehavior(context.category);

        try {
            const validatorPayload = {
                model: this.model,
                temperature: 0,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: [
                            'You are a strict category validator for language-learning dialogues.',
                            'Return ONLY valid JSON with this schema:',
                            '{"isAllOnCategory":true|false,"offCategoryIndexes":[0-based indexes]}.',
                            categoryBehavior.validatorRule,
                            'isAllOnCategory must be true only when all 25 conversations strongly match the selected conversation variant.',
                            'Also ensure each conversation has 16 short natural lines and no speaker labels.'
                        ].join('\n')
                    },
                    {
                        role: 'user',
                        content: [
                            `Language: ${context.languageName} (${context.languageCode})`,
                            `Level: ${context.level}`,
                            `Location focus: ${context.locationLabel}`,
                            `Conversation variant: ${context.category}`,
                            'Check whether these 25 conversations strongly match the selected conversation variant overall:',
                            JSON.stringify({ conversations })
                        ].join('\n')
                    }
                ]
            };

            const validation = await this.requestDeepSeekCompletion(apiKey, validatorPayload);
            const content = validation?.choices?.[0]?.message?.content;
            if (!content) {
                return { isAllOnCategory: false, offCategoryIndexes: conversations.map((_, index) => index) };
            }

            const parsed = this.parseGeneratedContent(content);
            const offCategoryIndexes = Array.isArray(parsed?.offCategoryIndexes)
                ? parsed.offCategoryIndexes
                    .map(index => Number(index))
                    .filter(index => Number.isInteger(index) && index >= 0 && index < conversations.length)
                : [];

            const isAllOnCategory = Boolean(parsed?.isAllOnCategory) && offCategoryIndexes.length === 0;
            return {
                isAllOnCategory,
                offCategoryIndexes: isAllOnCategory ? [] : (offCategoryIndexes.length > 0 ? offCategoryIndexes : conversations.map((_, index) => index))
            };
        } catch (error) {
            console.warn('Category validation failed, treating all conversations as needing rewrite.', error);
            return { isAllOnCategory: false, offCategoryIndexes: conversations.map((_, index) => index) };
        }
    }

    async rewriteOffCategoryConversations(apiKey, conversations, offCategoryIndexes, context) {
        const categoryBehavior = this.getCategoryBehavior(context.category);
        const indexesToRewrite = Array.isArray(offCategoryIndexes) && offCategoryIndexes.length > 0
            ? [...new Set(offCategoryIndexes)]
            : conversations.map((_, index) => index);

        const selected = indexesToRewrite.map(index => ({
            index,
            title: conversations[index]?.title || `Conversation ${index + 1}`,
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
                        'You rewrite dialogues so they strictly match a selected category while preserving language-learning clarity.',
                        'Return ONLY valid minified JSON: {"conversations":[{"index":0,"title":"...","lines":["16 lines"]}]}',
                        'Rules:',
                        '- Rewrite only the provided conversations.',
                        '- Keep the same index for each rewritten conversation.',
                        '- Each rewritten conversation must have exactly 16 short lines.',
                        categoryBehavior.rewriteRule,
                        '- Use everyday real-life situations only.',
                        '- Keep content safe and culturally appropriate.',
                        '- Do not include speaker labels in lines.',
                        '- End each conversation with a natural or engaging final line.'
                    ].join('\n')
                },
                {
                    role: 'user',
                    content: [
                        `Language: ${context.languageName} (${context.languageCode})`,
                        `Level: ${context.level}`,
                        `Location focus: ${context.locationLabel}`,
                        `Conversation variant: ${context.category}`,
                        'Rewrite these conversations so they strongly match the selected conversation variant:',
                        JSON.stringify({ conversations: selected })
                    ].join('\n')
                }
            ]
        };

        try {
            const rewriteResponse = await this.requestDeepSeekCompletion(apiKey, rewritePayload);
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

                const title = String(item?.title || updated[index].title || `Conversation ${index + 1}`).trim();
                const sourceLines = Array.isArray(item?.lines) ? item.lines : [];
                const cleaned = sourceLines
                    .map(line => String(line || '').trim())
                    .filter(Boolean)
                    .map(line => line.replace(/^\d+[\.)-]\s*/, '').trim());

                const lines = cleaned.slice(0, 16);
                while (lines.length < 16) {
                    lines.push(categoryBehavior.fallbackLine);
                }

                updated[index] = {
                    title: title || `Conversation ${index + 1}`,
                    lines
                };
            });

            return updated;
        } catch (error) {
            console.warn('Failed to rewrite off-category conversations.', error);
            return conversations;
        }
    }

    async requestDeepSeekCompletion(apiKey, payload) {
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

            // Some DeepSeek deployments may reject response_format; retry once without it.
            if (response.status === 400 && payload?.response_format) {
                const lowerErr = String(errText || '').toLowerCase();
                const mentionsResponseFormat = lowerErr.includes('response_format') || lowerErr.includes('unsupported') || lowerErr.includes('invalid parameter');
                if (mentionsResponseFormat) {
                    const fallbackPayload = { ...payload };
                    delete fallbackPayload.response_format;
                    return this.requestDeepSeekCompletion(apiKey, fallbackPayload);
                }
            }

            if (this.isInvalidApiKeyError(response.status, errText)) {
                return { __invalidApiKey: true };
            }
            throw new Error(`DeepSeek API request failed (${response.status}): ${errText}`);
        }

        return response.json();
    }

    isInvalidApiKeyError(status, errorText) {
        if (status !== 401 && status !== 403) {
            return false;
        }

        const text = String(errorText || '').toLowerCase();
        return (
            text.includes('invalid_api_key') ||
            text.includes('invalid api key') ||
            text.includes('invalid key') ||
            text.includes('authentication') ||
            text.includes('unauthorized')
        );
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

    normalizeConversations(conversations, category = 'funny dialogues') {
        if (!Array.isArray(conversations) || conversations.length === 0) {
            throw new Error('No conversations were returned by Groq.');
        }

        const categoryBehavior = this.getCategoryBehavior(category);

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
                lines.push(categoryBehavior.fallbackLine);
            }

            return { title, lines };
        });

        while (normalized.length < 25) {
            const i = normalized.length + 1;
            normalized.push({
                title: `Real-Life Situation ${i}`,
                lines: Array.from({ length: 16 }, () => categoryBehavior.fallbackLine)
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
