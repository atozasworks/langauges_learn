// Dialogue Page JavaScript
class DialoguePage {
    constructor() {
        this.originalDialogue = '';
        this.modifiedDialogue = [];
        this.learnerNames = [];
        this.currentConversationIndex = 0;
        this.currentLineIndex = -1;
        this.currentLevel = '';
        this.isLoading = false;
        this.currentLanguage = 'English';
        this.allDialogue = [];
        this.levelConfig = {
            beginner: { label: 'Beginner', file: 'data/Beginner.json' },
            medium: { label: 'Medium', file: 'data/Medium.json' },
            expert: { label: 'Expert', file: 'data/Expert.json' }
        };
        this.levelConversations = [];
        this.filteredConversationIndexes = [];
        this.isAutoPlaying = false;
        this.autoPlayTimer = null;
        this.autoPlayDelay = 1500;
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('Dialogue Page initialized');
    }

    setupEventListeners() {
        const levelSelector = document.getElementById('level-selector');
        if (levelSelector) {
            levelSelector.addEventListener('change', async (e) => {
                await this.setCurrentLevel(e.target.value);
            });
        }

        // Conversation selector
        const conversationSelector = document.getElementById('conversation-selector');
        if (conversationSelector) {
            conversationSelector.addEventListener('change', (e) => {
                this.setCurrentConversation(parseInt(e.target.value));
            });
        }
        this.setupConversationDropdown();

        // Navigation buttons
        const prevConversationBtn = document.getElementById('prev-conversation-btn');
        const nextConversationBtn = document.getElementById('next-conversation-btn');
        const prevLineBtn = document.getElementById('prev-line-btn');
        const nextLineBtn = document.getElementById('next-line-btn');

        if (prevConversationBtn) {
            prevConversationBtn.addEventListener('click', () => this.previousConversation());
        }

        if (nextConversationBtn) {
            nextConversationBtn.addEventListener('click', () => this.nextConversation());
        }

        if (prevLineBtn) {
            prevLineBtn.addEventListener('click', () => this.previousLine());
        }

        if (nextLineBtn) {
            nextLineBtn.addEventListener('click', () => this.nextLine());
        }

        // Auto play controls
        const stopAutoBtn = document.getElementById('stop-auto-btn');
        const resumeAutoBtn = document.getElementById('resume-auto-btn');
        const speedSlider = document.getElementById('speed-slider');

        if (stopAutoBtn) {
            stopAutoBtn.addEventListener('click', () => this.stopAutoPlay());
        }

        if (resumeAutoBtn) {
            resumeAutoBtn.addEventListener('click', () => this.resumeAutoPlay());
        }

        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const speed = parseInt(e.target.value, 10);
                this.setAutoPlayDelay(speed);
            });
            this.setAutoPlayDelay(parseInt(speedSlider.value, 10));
        } else {
            this.updateSpeedLabel();
        }

        this.updateAutoPlayControlState();
    }

    async initializeWithLearners(learnerNames) {
        this.stopAutoPlay();
        this.learnerNames = learnerNames || [];
        if (this.learnerNames.length === 0) {
            this.showError('No learners selected. Please go back and select learners.');
            return;
        }

        await this.loadDialogue();
        this.startAutoPlay();
    }

    async loadDialogue() {
        this.setLoading(true);
        
        try {
            await this.applyTranslation();
            this.populateLevelSelector();
            await this.setCurrentLevel('');
            this.populateConversationSelector();
            this.showInfo('Please select a level and conversation to begin.');
            
        } catch (error) {
            console.error('Error loading dialogue:', error);
            this.showError(`Failed to initialize dialogue page for ${this.currentLanguage}.`);
            
            // Navigate back to home after a delay
            setTimeout(() => {
                if (app) {
                    app.showPage('home');
                }
            }, 5000);
        } finally {
            this.setLoading(false);
        }
    }

    async applyTranslation() {
        if (window.app && window.app.translationService) {
            const currentLang = window.app.translationService.getCurrentLanguage();
            if (currentLang !== 'en') {
                try {
                    // For Google Translate Widget, the translation happens automatically
                    // when the content is displayed. We just need to ensure the service is ready.
                    console.log(`Translation will be applied for language: ${currentLang}`);
                    
                    // Update language display
                    const currentLanguageElement = document.getElementById('current-language');
                    if (currentLanguageElement) {
                        const langName = window.app.translationService.getSupportedLanguages()[currentLang] || 'English';
                        currentLanguageElement.textContent = langName;
                    }
                } catch (error) {
                    console.error('Translation setup failed:', error);
                }
            }
        }
    }

    async refreshCurrentDialogue() {
        // Store current state
        const currentConversation = this.currentConversationIndex;
        const currentLine = this.currentLineIndex;
        
        // Reload dialogue with current translation
        await this.loadDialogue();
        
        // Restore state if possible
        if (currentConversation >= 0 && currentConversation < this.modifiedDialogue.length) {
            setTimeout(() => {
                this.setCurrentConversation(currentConversation);
                if (currentLine >= 0) {
                    this.currentLineIndex = currentLine;
                    this.displayConversation();
                }
            }, 500);
        }
    }

    processDialogue() {
        if (!this.originalDialogue || this.learnerNames.length === 0) {
            return;
        }

        // Replace speaker names with learner names
        const modifiedText = this.replaceAllBeforeColonWithLearners(this.originalDialogue, this.learnerNames);
        
        // Split into conversations
        this.allDialogue = this.splitIntoConversations(modifiedText);
        this.modifiedDialogue = [];
    }

    replaceAllBeforeColonWithLearners(text, learners) {
        if (!text || !Array.isArray(learners) || learners.length === 0) {
            return text;
        }

        const shuffledNames = this.shuffleArray([...learners]);
        const recentlyUsedNames = [];
        const minDistance = Math.min(3, learners.length - 1);

        const getRandomName = () => {
            return shuffledNames[Math.floor(Math.random() * shuffledNames.length)];
        };

        return text.replace(
            /^(.+?)\s*:(.*)$/gm,
            (match, beforeColon, afterColon) => {
                let assignedName = null;
                let attempts = 0;
                const maxAttempts = learners.length * 2;

                // Try to find a name that hasn't been recently used
                while (attempts < maxAttempts) {
                    const candidate = getRandomName();
                    attempts++;

                    if (!recentlyUsedNames.includes(candidate)) {
                        assignedName = candidate;
                        break;
                    }
                }

                // Fallback logic
                if (!assignedName) {
                    const fallbackPool = shuffledNames.filter(name => !recentlyUsedNames.includes(name));
                    assignedName = fallbackPool.length > 0 ? 
                        fallbackPool[Math.floor(Math.random() * fallbackPool.length)] : 
                        getRandomName();
                }

                recentlyUsedNames.push(assignedName);
                if (recentlyUsedNames.length > minDistance) {
                    recentlyUsedNames.shift();
                }

                return `<span class="learner-name"><strong>${assignedName}</strong></span>:<span class="conversation-text">${afterColon}</span>`;
            }
        );
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    splitIntoConversations(text) {
        const lines = text.split('\n');
        const conversations = [];
        let currentConversation = '';

        for (const line of lines) {
            if (line.includes('Conversation ') && currentConversation.trim() !== '') {
                conversations.push(currentConversation.trim());
                currentConversation = '';
            }
            currentConversation += line + '\n';
        }

        if (currentConversation.trim() !== '') {
            conversations.push(currentConversation.trim());
        }

        return conversations.filter(conv => conv.trim() !== '');
    }

    populateLevelSelector() {
        const levelSelector = document.getElementById('level-selector');
        if (!levelSelector) return;

        const preferredOrder = ['beginner', 'medium', 'expert'];
        const levelKeys = preferredOrder.filter((key) => this.levelConfig[key]).concat(
            Object.keys(this.levelConfig).filter((key) => !preferredOrder.includes(key))
        );

        levelSelector.innerHTML = '<option value="">Select Level</option>';
        levelKeys.forEach((levelKey) => {
            const option = document.createElement('option');
            option.value = levelKey;
            option.textContent = this.levelConfig[levelKey].label || levelKey;
            levelSelector.appendChild(option);
        });
    }

    async setCurrentLevel(levelKey) {
        this.currentLevel = levelKey || '';
        this.levelConversations = [];

        const levelSelector = document.getElementById('level-selector');
        if (levelSelector) {
            levelSelector.value = this.currentLevel;
        }

        if (!this.currentLevel || !this.levelConfig[this.currentLevel]) {
            this.modifiedDialogue = [];
            this.currentConversationIndex = 0;
            this.currentLineIndex = -1;
            this.populateConversationSelector();
            this.showInfo('Please select a level and conversation to begin.');
            this.stopAutoPlay();
            return;
        }

        try {
            const rawConversations = await this.loadConversationsForLevel(this.currentLevel);
            this.levelConversations = rawConversations;
            this.modifiedDialogue = rawConversations.map((conversation) => this.renderConversationWithLearners(conversation));
        } catch (error) {
            console.error(`Failed to load ${this.currentLevel} data:`, error);
            this.modifiedDialogue = [];
            this.levelConversations = [];
            this.populateConversationSelector();
            this.showError(`Unable to load ${this.currentLevel} conversations.`);
            this.stopAutoPlay();
            return;
        }

        this.currentConversationIndex = 0;
        this.currentLineIndex = -1;
        this.populateConversationSelector();
        this.showInfo(`Loaded ${this.modifiedDialogue.length} ${this.levelConfig[this.currentLevel].label} conversations. Select one from the dropdown.`);
        this.stopAutoPlay();
    }

    async loadConversationsForLevel(levelKey) {
        const definition = this.levelConfig[levelKey];
        if (!definition || !definition.file) {
            return [];
        }

        const response = await fetch(definition.file, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!payload || !Array.isArray(payload.conversations)) {
            throw new Error('Invalid JSON structure. Expected { conversations: [] }.');
        }

        return payload.conversations;
    }

    renderConversationWithLearners(conversation) {
        const lines = [];
        const number = conversation?.conversation_number || '';
        const title = conversation?.title || '';

        if (number) {
            lines.push(`Conversation ${number}`);
        }

        if (title) {
            lines.push(title);
        }

        const dialogues = Array.isArray(conversation?.dialogues) ? conversation.dialogues : [];
        dialogues.forEach((item) => {
            const speaker = (item?.speaker || '').trim();
            const text = (item?.text || '').trim();
            if (!speaker && !text) {
                return;
            }
            lines.push(`${speaker || 'Person'}: ${text}`);
        });

        const baseText = lines.join('\n');
        return this.replaceAllBeforeColonWithLearners(baseText, this.learnerNames);
    }

    populateConversationSelector() {
        const selector = document.getElementById('conversation-selector');
        if (!selector) return;

        selector.innerHTML = '<option value="">Select Conversation</option>';
        selector.disabled = this.modifiedDialogue.length === 0;

        this.modifiedDialogue.forEach((conversation, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = this.getConversationLabel(index);
            selector.appendChild(option);
        });

        const toggle = document.getElementById('conversation-toggle');
        const search = document.getElementById('conversation-search');
        if (toggle) {
            toggle.disabled = this.modifiedDialogue.length === 0;
            toggle.textContent = 'Select Conversation';
        }
        if (search) {
            search.value = '';
        }
        this.renderConversationList('');
        this.closeConversationMenu();
    }

    setCurrentConversation(index) {
        if (!Number.isInteger(index)) {
            return;
        }

        if (index < 0 || index >= this.modifiedDialogue.length) {
            return;
        }

        this.currentConversationIndex = index;
        this.currentLineIndex = -1;
        
        // Update conversation selector
        const selector = document.getElementById('conversation-selector');
        if (selector) {
            selector.value = index;
        }
        const toggle = document.getElementById('conversation-toggle');
        if (toggle) {
            toggle.textContent = this.getConversationLabel(index);
        }
        this.closeConversationMenu();

        // Display the conversation
        this.displayConversation();
        
        // Set current line to first learner line
        this.setFirstLearnerLine();
        
        // Update navigation buttons
        this.updateNavigationButtons();
    }

    getConversationLabel(index) {
        const meta = this.levelConversations[index] || {};
        const convNo = meta.conversation_number || index + 1;
        const title = (meta.title || '').trim();
        return title ? `Conversation ${convNo} - ${title}` : `Conversation ${convNo}`;
    }

    setupConversationDropdown() {
        const container = document.getElementById('conversation-custom');
        const toggle = document.getElementById('conversation-toggle');
        const menu = document.getElementById('conversation-menu');
        const search = document.getElementById('conversation-search');

        if (!container || !toggle || !menu) {
            return;
        }

        toggle.addEventListener('click', () => {
            if (toggle.disabled) return;
            if (menu.hidden) {
                this.openConversationMenu();
            } else {
                this.closeConversationMenu();
            }
        });

        if (search) {
            search.addEventListener('input', (e) => {
                this.renderConversationList((e.target.value || '').trim());
            });
            search.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeConversationMenu();
                    toggle.focus();
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.closeConversationMenu();
            }
        });
    }

    openConversationMenu() {
        const toggle = document.getElementById('conversation-toggle');
        const menu = document.getElementById('conversation-menu');
        const search = document.getElementById('conversation-search');
        if (!toggle || !menu || toggle.disabled) return;

        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        this.renderConversationList((search?.value || '').trim());
        if (search) {
            setTimeout(() => search.focus(), 0);
        }
    }

    closeConversationMenu() {
        const toggle = document.getElementById('conversation-toggle');
        const menu = document.getElementById('conversation-menu');
        if (!toggle || !menu) return;

        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    }

    renderConversationList(filterText) {
        const list = document.getElementById('conversation-list');
        if (!list) return;

        list.innerHTML = '';
        const normalizedFilter = (filterText || '').toLowerCase();
        this.filteredConversationIndexes = [];

        this.modifiedDialogue.forEach((_, index) => {
            const label = this.getConversationLabel(index);
            if (normalizedFilter && !label.toLowerCase().includes(normalizedFilter)) {
                return;
            }
            this.filteredConversationIndexes.push(index);

            const item = document.createElement('li');
            item.className = 'conversation-item';
            if (index === this.currentConversationIndex) {
                item.classList.add('active');
            }
            item.textContent = label;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', index === this.currentConversationIndex ? 'true' : 'false');
            item.addEventListener('click', () => {
                this.setCurrentConversation(index);
            });
            list.appendChild(item);
        });

        if (this.filteredConversationIndexes.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'conversation-item empty';
            empty.textContent = 'No conversations found';
            list.appendChild(empty);
        }
    }

    setAutoPlayDelay(delayMs) {
        const parsed = Number.isFinite(delayMs) ? delayMs : 1500;
        this.autoPlayDelay = Math.min(3000, Math.max(500, parsed));
        this.updateSpeedLabel();
    }

    updateSpeedLabel() {
        const speedValue = document.getElementById('speed-value');
        if (speedValue) {
            speedValue.textContent = `${(this.autoPlayDelay / 1000).toFixed(1)}s`;
        }
    }

    updateAutoPlayControlState() {
        const stopAutoBtn = document.getElementById('stop-auto-btn');
        const resumeAutoBtn = document.getElementById('resume-auto-btn');

        if (stopAutoBtn) {
            stopAutoBtn.disabled = !this.isAutoPlaying;
        }

        if (resumeAutoBtn) {
            resumeAutoBtn.disabled = this.isAutoPlaying || this.modifiedDialogue.length === 0;
        }
    }

    clearAutoPlayTimer() {
        if (this.autoPlayTimer) {
            clearTimeout(this.autoPlayTimer);
            this.autoPlayTimer = null;
        }
    }

    startAutoPlay() {
        if (this.modifiedDialogue.length === 0) return;
        this.clearAutoPlayTimer();
        this.isAutoPlaying = true;
        this.updateAutoPlayControlState();
        this.scheduleNextAutoStep();
    }

    stopAutoPlay() {
        this.clearAutoPlayTimer();
        this.isAutoPlaying = false;
        this.updateAutoPlayControlState();
    }

    resumeAutoPlay() {
        if (this.modifiedDialogue.length === 0 || this.isAutoPlaying) {
            return;
        }
        this.startAutoPlay();
    }

    scheduleNextAutoStep() {
        this.clearAutoPlayTimer();
        this.autoPlayTimer = setTimeout(() => {
            this.autoPlayStep();
        }, this.autoPlayDelay);
    }

    autoPlayStep() {
        if (!this.isAutoPlaying || this.modifiedDialogue.length === 0) {
            return;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        const isLastLine = this.currentLineIndex >= lines.length - 1;
        const isLastConversation = this.currentConversationIndex >= this.modifiedDialogue.length - 1;

        if (isLastLine) {
            if (isLastConversation) {
                this.stopAutoPlay();
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast('All conversations completed.', 'success');
                }
                return;
            }

            this.setCurrentConversation(this.currentConversationIndex + 1);
        } else {
            this.nextLine();
        }

        if (this.isAutoPlaying) {
            this.scheduleNextAutoStep();
        }
    }

    displayConversation() {
        const scriptText = document.getElementById('script-text');
        if (!scriptText || this.currentConversationIndex >= this.modifiedDialogue.length) {
            return;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        scriptText.innerHTML = this.renderHighlightedDialogue(conversation);
    }

    renderHighlightedDialogue(dialogue) {
        const lines = dialogue.split('\n');
        return lines.map((line, index) => {
            const isHighlighted = index === this.currentLineIndex;
            const className = isHighlighted ? 'highlighted-line' : '';
            const id = isHighlighted ? 'highlighted-line' : '';
            
            return `<div class="${className}" id="${id}">${line}</div>`;
        }).join('');
    }

    setFirstLearnerLine() {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) {
            return;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        
        // Find the first line that contains learner-name class
        const firstLearnerLineIndex = lines.findIndex(line => 
            line.includes('learner-name')
        );
        
        this.currentLineIndex = firstLearnerLineIndex >= 0 ? firstLearnerLineIndex : 0;
        this.displayConversation();
        this.scrollToHighlightedLine();
    }

    nextLine() {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) {
            return;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        
        if (this.currentLineIndex < lines.length - 1) {
            this.currentLineIndex++;
            this.displayConversation();
            this.scrollToHighlightedLine();
        }
        
        this.updateNavigationButtons();
    }

    previousLine() {
        if (this.currentLineIndex > 0) {
            this.currentLineIndex--;
            this.displayConversation();
            this.scrollToHighlightedLine();
        }
        
        this.updateNavigationButtons();
    }

    nextConversation() {
        if (this.currentConversationIndex < this.modifiedDialogue.length - 1) {
            this.setCurrentConversation(this.currentConversationIndex + 1);
        }
    }

    previousConversation() {
        if (this.currentConversationIndex > 0) {
            this.setCurrentConversation(this.currentConversationIndex - 1);
        }
    }

    scrollToHighlightedLine() {
        const container = document.querySelector('.conversation-block');
        const highlightedLine = document.getElementById('highlighted-line');
        if (!container || !highlightedLine) {
            return;
        }

        // Scroll only inside the dialogue container (never the full page).
        const targetTop = highlightedLine.offsetTop - (container.clientHeight / 2) + (highlightedLine.clientHeight / 2);
        container.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth'
        });
    }

    updateNavigationButtons() {
        const prevConversationBtn = document.getElementById('prev-conversation-btn');
        const nextConversationBtn = document.getElementById('next-conversation-btn');
        const prevLineBtn = document.getElementById('prev-line-btn');
        const nextLineBtn = document.getElementById('next-line-btn');

        // Conversation navigation
        if (prevConversationBtn) {
            prevConversationBtn.disabled = this.currentConversationIndex <= 0;
        }
        
        if (nextConversationBtn) {
            nextConversationBtn.disabled = this.currentConversationIndex >= this.modifiedDialogue.length - 1;
        }

        // Line navigation
        if (prevLineBtn) {
            prevLineBtn.disabled = this.currentLineIndex <= 0;
        }
        
        if (nextLineBtn && this.currentConversationIndex < this.modifiedDialogue.length) {
            const conversation = this.modifiedDialogue[this.currentConversationIndex];
            const lines = conversation.split('\n');
            nextLineBtn.disabled = this.currentLineIndex >= lines.length - 1;
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        const scriptText = document.getElementById('script-text');
        
        if (scriptText) {
            if (loading) {
                scriptText.innerHTML = '<div class="loading">Loading dialogue...</div>';
                this.stopAutoPlay();
            }
        }
    }

    showError(message) {
        const scriptText = document.getElementById('script-text');
        if (scriptText) {
            scriptText.innerHTML = `
                <div style="text-align: center; color: #ef4444; padding: 2rem;">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                        Redirecting to home page in 5 seconds...
                    </p>
                </div>
            `;
        }
    }

    showInfo(message) {
        const scriptText = document.getElementById('script-text');
        if (scriptText) {
            scriptText.innerHTML = `
                <div style="text-align: center; color: #374151; padding: 2rem;">
                    <p>${message}</p>
                </div>
            `;
        }
    }

    // Public methods
    setLanguage(language) {
        this.currentLanguage = language;
        const languageElement = document.getElementById('current-language');
        if (languageElement) {
            languageElement.textContent = language;
        }
    }

    getCurrentConversation() {
        return this.currentConversationIndex;
    }

    getCurrentLine() {
        return this.currentLineIndex;
    }

    getTotalConversations() {
        return this.modifiedDialogue.length;
    }

    getLearnerNames() {
        return this.learnerNames;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DialoguePage;
} 
