// Dialogue Page JavaScript
class DialoguePage {
    constructor() {
        this.originalDialogue = '';
        this.modifiedDialogue = [];
        this.learnerNames = [];
        this.currentConversationIndex = 0;
        this.currentLineIndex = -1;
        this.isLoading = false;
        this.currentLanguage = 'English';

        // Auto-advance (dialog-to-dialog) settings
        this.autoAdvanceEnabled = true;
        this.autoAdvanceInitialDelayMs = 4000; // first line in a new conversation
        this.autoAdvanceDelayMs = 3000; // subsequent lines
        this.autoAdvanceTimeoutId = null;

        // Keep initial-vs-normal gap consistent when changing speed via slider
        this.autoAdvanceInitialOffsetMs = Math.max(0, this.autoAdvanceInitialDelayMs - this.autoAdvanceDelayMs);
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('Dialogue Page initialized');
    }

    setupEventListeners() {
        // Conversation selector
        const conversationSelector = document.getElementById('conversation-selector');
        if (conversationSelector) {
            conversationSelector.addEventListener('change', (e) => {
                this.setCurrentConversation(parseInt(e.target.value));
            });
        }

        // Navigation buttons
        const prevConversationBtn = document.getElementById('prev-conversation-btn');
        const nextConversationBtn = document.getElementById('next-conversation-btn');
        const prevLineBtn = document.getElementById('prev-line-btn');
        const nextLineBtn = document.getElementById('next-line-btn');
        const toggleAutoAdvanceBtn = document.getElementById('toggle-auto-advance-btn');
        const speedSlider = document.getElementById('speed-slider');

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

        if (toggleAutoAdvanceBtn) {
            toggleAutoAdvanceBtn.addEventListener('click', () => this.toggleAutoAdvance());
            this._syncAutoAdvanceButton();
        }

        if (speedSlider) {
            this._initSpeedSlider(speedSlider);
            speedSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                this.setAutoAdvanceSpeed(value);
            });
        }
    }

    _initSpeedSlider(speedSlider) {
        // Ensure default knob starts in the middle based on current code value
        const min = 1000;
        const max = Math.max(min + 1000, (this.autoAdvanceDelayMs * 2) - min);
        speedSlider.min = String(min);
        speedSlider.max = String(max);
        speedSlider.step = '250';
        speedSlider.value = String(this.autoAdvanceDelayMs);
        this._updateSpeedValueUI(this.autoAdvanceDelayMs);
    }

    _updateSpeedValueUI(delayMs) {
        const el = document.getElementById('speed-value');
        if (!el) return;
        el.textContent = `${(delayMs / 1000).toFixed(1)}s`;
    }

    setAutoAdvanceSpeed(delayMs) {
        const safeDelayMs = Math.max(250, Number.isFinite(delayMs) ? delayMs : this.autoAdvanceDelayMs);
        this.autoAdvanceDelayMs = safeDelayMs;
        this.autoAdvanceInitialDelayMs = safeDelayMs + this.autoAdvanceInitialOffsetMs;
        this._updateSpeedValueUI(safeDelayMs);

        // If currently running, reschedule with new speed
        if (this.autoAdvanceEnabled) {
            if (this._hasNextLine() || this._hasNextConversation()) {
                const delay = this._isAtFirstLearnerLine()
                    ? this.autoAdvanceInitialDelayMs
                    : this.autoAdvanceDelayMs;
                this._scheduleAutoAdvance(delay);
            } else {
                this.stopAutoAdvance();
            }
        }
    }

    toggleAutoAdvance() {
        this.autoAdvanceEnabled = !this.autoAdvanceEnabled;

        if (!this.autoAdvanceEnabled) {
            this.stopAutoAdvance();
        } else {
            // When resuming, prefer the "initial delay" if currently at the first learner line
            if (this._hasNextLine() || this._hasNextConversation()) {
                const delay = this._isAtFirstLearnerLine()
                    ? this.autoAdvanceInitialDelayMs
                    : this.autoAdvanceDelayMs;
                this._scheduleAutoAdvance(delay);
            }
        }

        this._syncAutoAdvanceButton();
    }

    _isAtFirstLearnerLine() {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) return false;
        if (this.currentLineIndex < 0) return false;

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        const firstLearnerLineIndex = lines.findIndex(line => line.includes('learner-name'));
        return firstLearnerLineIndex >= 0 && this.currentLineIndex === firstLearnerLineIndex;
    }

    _syncAutoAdvanceButton() {
        const btn = document.getElementById('toggle-auto-advance-btn');
        if (!btn) return;

        const isPaused = !this.autoAdvanceEnabled;
        btn.classList.toggle('is-paused', isPaused);
        btn.title = isPaused ? 'Resume auto scroll' : 'Pause auto scroll';
        btn.setAttribute('aria-label', isPaused ? 'Resume auto scroll' : 'Pause auto scroll');

        // Swap icon (lucide)
        btn.innerHTML = `<i data-lucide="${isPaused ? 'play' : 'pause'}"></i>`;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    stopAutoAdvance() {
        if (this.autoAdvanceTimeoutId) {
            clearTimeout(this.autoAdvanceTimeoutId);
            this.autoAdvanceTimeoutId = null;
        }
    }

    resumeAutoAdvance() {
        if (!this.autoAdvanceEnabled) return;
        if (this.isLoading) return;
        if (!this._hasNextLine() && !this._hasNextConversation()) return;
        this._scheduleAutoAdvance(this.autoAdvanceDelayMs);
    }

    _scheduleAutoAdvance(delayMs) {
        if (!this.autoAdvanceEnabled) return;
        this.stopAutoAdvance();
        this.autoAdvanceTimeoutId = setTimeout(() => {
            this.autoAdvanceTimeoutId = null;
            this._autoAdvanceTick();
        }, delayMs);
    }

    _autoAdvanceTick() {
        if (!this.autoAdvanceEnabled) return;
        if (this.isLoading) return;

        const didAdvance = this.nextLine({ fromAutoAdvance: true });
        if (didAdvance) {
            this._scheduleAutoAdvance(this.autoAdvanceDelayMs);
            return;
        }

        // If conversation ended, jump to next conversation automatically
        if (this._hasNextConversation()) {
            this.setCurrentConversation(this.currentConversationIndex + 1);
            return; // setCurrentConversation schedules the initial delay
        }

        // Last conversation finished
        this.stopAutoAdvance();
    }

    _hasNextLine() {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) return false;
        if (this.currentLineIndex < 0) return false;

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        return this.currentLineIndex < lines.length - 1;
    }

    _hasNextConversation() {
        return this.currentConversationIndex >= 0 &&
               this.currentConversationIndex < this.modifiedDialogue.length - 1;
    }

    async initializeWithLearners(learnerNames) {
        this.learnerNames = learnerNames || [];
        if (this.learnerNames.length === 0) {
            this.showError('No learners selected. Please go back and select learners.');
            return;
        }

        await this.loadDialogue();
    }

    async loadDialogue() {
        this.setLoading(true);
        
        try {
            // Use embedded dialogue data instead of fetching files
            if (typeof getDialogueForLanguage === 'undefined') {
                throw new Error('Dialogue data not loaded. Please ensure dialogue-data.js is included.');
            }
            
            const dialogueText = getDialogueForLanguage(this.currentLanguage);
            
            if (!dialogueText || dialogueText.trim() === '') {
                throw new Error(`No dialogue content found for language: ${this.currentLanguage}`);
            }

            this.originalDialogue = dialogueText;
            
            // Apply translation if needed
            await this.applyTranslation();
            
            this.processDialogue();
            this.populateConversationSelector();
            this.setCurrentConversation(0);
            
        } catch (error) {
            console.error('Error loading dialogue:', error);
            this.showError(`Failed to load dialogue script for ${this.currentLanguage}. Available languages: ${getAvailableLanguages().join(', ')}`);
            
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
                    this.scrollToHighlightedLine();
                    if (this.autoAdvanceEnabled) {
                        this.resumeAutoAdvance();
                    }
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
        this.modifiedDialogue = this.splitIntoConversations(modifiedText);
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

    populateConversationSelector() {
        const selector = document.getElementById('conversation-selector');
        if (!selector) return;

        selector.innerHTML = '';
        
        this.modifiedDialogue.forEach((conversation, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Conversation ${index + 1}`;
            selector.appendChild(option);
        });
    }

    updateConversationHeading() {
        const headingEl = document.getElementById('conversation-heading');
        if (!headingEl) return;

        headingEl.replaceChildren();

        if (this.currentConversationIndex < 0 || this.currentConversationIndex >= this.modifiedDialogue.length) {
            return;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = String(conversation || '').split('\n');

        // Conversation heading lines are expected to be before the first learner line
        const firstLearnerLineIndex = lines.findIndex(line => String(line).includes('learner-name'));
        const headerLines = (firstLearnerLineIndex > 0 ? lines.slice(0, firstLearnerLineIndex) : lines.slice(0, 2))
            .map(l => String(l).trim())
            .filter(Boolean);

        // Show ONLY the title (ex: "At Hospital / Clinic"), not the "Conversation X" line
        const titleLine =
            headerLines.find(l => !l.includes('Conversation') && !l.includes(':') && !l.includes('learner-name')) ||
            `Conversation ${this.currentConversationIndex + 1}`;

        if (titleLine) {
            const titleDiv = document.createElement('div');
            titleDiv.className = 'conversation-title';
            titleDiv.textContent = titleLine;
            headingEl.appendChild(titleDiv);
        }
    }

    setCurrentConversation(index) {
        if (index < 0 || index >= this.modifiedDialogue.length) {
            return;
        }

        this.currentConversationIndex = index;
        this.currentLineIndex = -1;
        this.stopAutoAdvance();
        
        // Update conversation selector
        const selector = document.getElementById('conversation-selector');
        if (selector) {
            selector.value = index;
        }

        this.updateConversationHeading();

        // Set current line to first learner line, then display
        this.setFirstLearnerLine();

        // Auto-advance: first line should stay longer (6s) for every new conversation
        if (this.autoAdvanceEnabled) {
            this._scheduleAutoAdvance(this.autoAdvanceInitialDelayMs);
        }
        this._syncAutoAdvanceButton();
        
        // Update navigation buttons
        this.updateNavigationButtons();
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
        // Determine which indices to show: current and next
        let currentIndex = this.currentLineIndex;
        if (currentIndex < 0) {
            // Fallback to first learner line if not set
            const firstLearnerLineIndex = lines.findIndex(l => l.includes('learner-name'));
            currentIndex = firstLearnerLineIndex >= 0 ? firstLearnerLineIndex : 0;
        }

        // Find the next non-empty line after current
        let nextIndex = -1;
        for (let i = currentIndex + 1; i < lines.length; i++) {
            if (String(lines[i]).trim() !== '') {
                nextIndex = i;
                break;
            }
        }

        const visibleIndices = [currentIndex];
        if (nextIndex !== -1) visibleIndices.push(nextIndex);

        return visibleIndices.map((index) => {
            const line = lines[index];
            const isHighlighted = index === currentIndex;
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

    nextLine(options = {}) {
        if (this.currentConversationIndex >= this.modifiedDialogue.length) {
            return false;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        let didAdvance = false;
        
        if (this.currentLineIndex < lines.length - 1) {
            this.currentLineIndex++;
            this.displayConversation();
            this.scrollToHighlightedLine();
            didAdvance = true;
        }
        
        this.updateNavigationButtons();

        // Manual navigation should restart auto-advance with normal delay (5s)
        if (!options.fromAutoAdvance && this.autoAdvanceEnabled) {
            this.resumeAutoAdvance();
        }

        return didAdvance;
    }

    previousLine() {
        if (this.currentLineIndex > 0) {
            this.currentLineIndex--;
            this.displayConversation();
            this.scrollToHighlightedLine();
        }
        
        this.updateNavigationButtons();

        // Manual navigation should restart auto-advance with normal delay (5s)
        if (this.autoAdvanceEnabled) {
            this.resumeAutoAdvance();
        }
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

    scrollToHighlightedLine(options = {}) {
        const highlightedLine = document.getElementById('highlighted-line');
        if (!highlightedLine) return;

        const behavior = options.behavior || 'smooth';

        // Prefer scrolling only inside the conversation panel (avoid page scroll)
        const container = highlightedLine.closest('.conversation-block');
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const lineRect = highlightedLine.getBoundingClientRect();

            // Distance of the line from the top of the container's visible area
            const lineOffsetInContainer = (lineRect.top - containerRect.top);

            // Center the highlighted line within the container
            const targetTop =
                container.scrollTop +
                lineOffsetInContainer -
                (containerRect.height / 2) +
                (lineRect.height / 2);

            const clampedTop = Math.max(0, Math.min(targetTop, container.scrollHeight - containerRect.height));
            container.scrollTo({ top: clampedTop, behavior });
            return;
        }

        // Fallback (should rarely happen)
        highlightedLine.scrollIntoView({ behavior, block: 'center' });
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
        const headingEl = document.getElementById('conversation-heading');
        
        if (scriptText) {
            if (loading) {
                scriptText.innerHTML = '<div class="loading">Loading dialogue...</div>';
            }
        }

        if (headingEl && loading) {
            headingEl.replaceChildren();
        }
    }

    showError(message) {
        const scriptText = document.getElementById('script-text');
        const headingEl = document.getElementById('conversation-heading');
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

        if (headingEl) {
            headingEl.replaceChildren();
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