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

        // Sidebar add member button functionality
        const sidebarAddMemberBtn = document.getElementById('sidebar-add-member-btn');
        
        if (sidebarAddMemberBtn) {
            sidebarAddMemberBtn.addEventListener('click', () => this.openAddMemberPopup());
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
        
        // Check if learning session has ended
        if (window.learnHomeInstance && window.learnHomeInstance.isSessionEnded()) {
            console.log('Session ended, not scheduling auto-advance');
            return;
        }
        
        // Calculate additional time based on word length
        const adjustedDelay = this._calculateAdjustedDelay(delayMs);
        
        this.stopAutoAdvance();
        this.autoAdvanceTimeoutId = setTimeout(() => {
            this.autoAdvanceTimeoutId = null;
            this._autoAdvanceTick();
        }, adjustedDelay);
    }

    _calculateAdjustedDelay(baseDelayMs) {
        // Get the current line text
        if (this.currentConversationIndex >= this.modifiedDialogue.length || this.currentLineIndex < 0) {
            return baseDelayMs;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        const currentLine = lines[this.currentLineIndex] || '';

        // Extract text content (remove HTML tags)
        const textContent = currentLine.replace(/<[^>]*>/g, '').trim();

        // Split into words and check for long words (5+ characters)
        const words = textContent.split(/\s+/).filter(word => word.length > 0);
        const longWords = words.filter(word => word.length >= 5);

        // If there are 4 or more long words, add 3 seconds (3000ms) to the base delay
        if (longWords.length >= 4) {
            return baseDelayMs + 3000;
        }

        return baseDelayMs;
    }

    _autoAdvanceTick() {
        if (!this.autoAdvanceEnabled) return;
        if (this.isLoading) return;

        // Check if learning session has ended
        if (window.learnHomeInstance && window.learnHomeInstance.isSessionEnded()) {
            console.log('Session ended, stopping auto-advance');
            this.stopAutoAdvance();
            return;
        }

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

    async initializeWithLearners(learnerNames, isGroupMode = false) {
        this.learnerNames = learnerNames || [];
        this.isGroupMode = isGroupMode;
        this.isAIMode = false;
        
        if (this.learnerNames.length === 0) {
            this.showError('No learners selected. Please go back and select learners.');
            return;
        }

        // Show/hide and populate the learners sidebar based on mode
        this.handleLearnersSidebar();

        await this.loadDialogue();
    }

    async initializeWithAIMode(learnerNames) {
        this.learnerNames = learnerNames || ['AI Assistant'];
        this.isGroupMode = false;
        this.isAIMode = true;
        
        // Hide the learners sidebar for AI mode
        const sidebar = document.getElementById('learners-sidebar');
        if (sidebar) {
            sidebar.style.display = 'none';
        }

        // Update the page title to indicate AI mode
        const currentLanguageSpan = document.getElementById('current-language');
        if (currentLanguageSpan) {
            currentLanguageSpan.textContent = 'English (AI Enhanced)';
        }

        // Show AI topic selector instead of regular conversation selector
        await this.setupAITopicSelector();

        // Initialize with the first topic
        await this.loadAIDialogue();
    }

    handleLearnersSidebar() {
        const sidebar = document.getElementById('learners-sidebar');
        
        if (!sidebar) return;

        if (this.isGroupMode) {
            // Show sidebar for group mode
            sidebar.style.display = 'block';
            this.populateLearnersSidebar();
        } else {
            // Hide sidebar for regular learning mode
            sidebar.style.display = 'none';
        }
    }

    populateLearnersSidebar() {
        const learnersList = document.getElementById('learners-list');
        if (!learnersList) return;

        // Clear existing list
        learnersList.innerHTML = '';

        // Add each learner to the list
        this.learnerNames.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            li.className = 'learner-item';
            learnersList.appendChild(li);
        });
    }

    openAddMemberPopup() {
        // Get access to learnHomeInstance
        if (!window.learnHomeInstance) {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Unable to access learner list', 'error');
            }
            return;
        }

        const learnHome = window.learnHomeInstance;
        
        // Populate the group selection popup with all learners
        const groupMembersList = document.getElementById('group-members-list');
        if (!groupMembersList) return;

        // Clear existing list
        groupMembersList.innerHTML = '';

        // Get current learner IDs for comparison
        const currentLearnerIds = this.learnerNames.map(name => {
            const learner = learnHome.learners.find(l => l.name === name);
            return learner ? learner.id : null;
        }).filter(id => id !== null);

        // Add each learner to the popup with checkbox
        learnHome.learners.forEach(learner => {
            const memberDiv = document.createElement('div');
            memberDiv.style.cssText = 'display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #e5e7eb;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'group-member-checkbox';
            checkbox.id = `sidebar-member-${learner.id}`;
            checkbox.dataset.id = learner.id;
            checkbox.dataset.name = learner.name;
            checkbox.style.cssText = 'margin-right: 10px; cursor: pointer; width: 18px; height: 18px;';
            
            // Check if this learner is already in the current dialogue
            checkbox.checked = currentLearnerIds.includes(learner.id);
            
            const label = document.createElement('label');
            label.htmlFor = `sidebar-member-${learner.id}`;
            label.textContent = learner.name;
            label.style.cssText = 'cursor: pointer; flex: 1; font-size: 1rem;';
            
            memberDiv.appendChild(checkbox);
            memberDiv.appendChild(label);
            groupMembersList.appendChild(memberDiv);
        });

        // Update the selected count
        this.updateSidebarGroupCount();

        // Update select all checkbox
        this.updateSidebarSelectAllCheckbox();

        // Setup event listeners for checkboxes
        const checkboxes = document.querySelectorAll('.group-member-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSidebarGroupCount();
                this.updateSidebarSelectAllCheckbox();
            });
        });

        // Setup select all checkbox
        const selectAllCheckbox = document.getElementById('group-select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                });
                this.updateSidebarGroupCount();
            });
        }

        // Override the confirm button to use our method
        const groupStartBtn = document.getElementById('group-start-btn');
        if (groupStartBtn) {
            // Remove existing listeners by cloning
            const newGroupStartBtn = groupStartBtn.cloneNode(true);
            groupStartBtn.parentNode.replaceChild(newGroupStartBtn, groupStartBtn);
            
            newGroupStartBtn.addEventListener('click', () => this.confirmSidebarMemberSelection());
        }

        // Show the popup
        if (typeof Utils !== 'undefined' && Utils.showPopup) {
            Utils.showPopup('group-selection-popup');
        }

        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    updateSidebarGroupCount() {
        const checkboxes = document.querySelectorAll('.group-member-checkbox:checked');
        const countElement = document.getElementById('group-selected-count');
        if (countElement) {
            countElement.textContent = `${checkboxes.length} selected`;
        }
    }

    updateSidebarSelectAllCheckbox() {
        const allCheckboxes = document.querySelectorAll('.group-member-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.group-member-checkbox:checked');
        const selectAllCheckbox = document.getElementById('group-select-all');
        
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = allCheckboxes.length > 0 && 
                                       allCheckboxes.length === checkedCheckboxes.length;
        }
    }

    confirmSidebarMemberSelection() {
        const checkboxes = document.querySelectorAll('.group-member-checkbox:checked');
        
        if (checkboxes.length === 0) {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Please select at least one member', 'warning');
            }
            return;
        }

        // Get selected learner names
        const selectedNames = Array.from(checkboxes).map(cb => cb.dataset.name);

        // Update learner names array
        this.learnerNames = selectedNames;

        // Reprocess the dialogue with the new learners
        this.processDialogue();
        
        // Refresh the current conversation display
        this.setCurrentConversation(this.currentConversationIndex);
        
        // Update the sidebar display
        this.populateLearnersSidebar();

        // Hide the popup
        if (typeof Utils !== 'undefined' && Utils.hidePopup) {
            Utils.hidePopup('group-selection-popup');
        }

        // Show success message
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast(`Members updated successfully! (${checkboxes.length} selected)`, 'success');
        }

        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
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

        // Display the conversation
        this.displayConversation();
        
        // Set current line to first learner line
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
        return lines.map((line, index) => {
            const isHighlighted = index === this.currentLineIndex;
            const trimmedLine = line.trim();
            
            // Detect "Conversation X" lines (smaller font)
            const isConversationNumber = trimmedLine.startsWith('Conversation ') && /^Conversation \d+/.test(trimmedLine);
            
            // Detect "Basic Introduction and Greetings" type titles (larger font, bold, underline)
            const isConversationTitle = trimmedLine.includes('Basic Introduction') || 
                                       (trimmedLine !== '' && !trimmedLine.includes(':') && 
                                        !isConversationNumber && trimmedLine.length > 10 && 
                                        !trimmedLine.match(/^Person \d+:/));
            
            let className = isHighlighted ? 'highlighted-line' : '';
            if (isConversationNumber) {
                className = className ? `${className} conversation-number` : 'conversation-number';
            } else if (isConversationTitle) {
                className = className ? `${className} conversation-title` : 'conversation-title';
            }
            
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

    scrollToHighlightedLine() {
        const highlightedLine = document.getElementById('highlighted-line');
        const conversationBlock = document.querySelector('.conversation-block');
        
        if (highlightedLine && conversationBlock) {
            // Calculate the position of the highlighted line relative to the conversation block
            const lineTop = highlightedLine.offsetTop;
            const lineHeight = highlightedLine.offsetHeight;
            const containerHeight = conversationBlock.clientHeight;
            
            // Scroll to center the highlighted line within the conversation block
            const scrollPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
            
            conversationBlock.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
            });
        }
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

    setLoading(loading, message = 'Loading dialogue...') {
        this.isLoading = loading;
        const scriptText = document.getElementById('script-text');
        
        if (scriptText) {
            if (loading) {
                scriptText.innerHTML = `<div class="loading">${message}</div>`;
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

    // AI Methods
    async setupAITopicSelector() {
        const conversationSelector = document.getElementById('conversation-selector');
        if (!conversationSelector) return;

        // Clear existing options
        conversationSelector.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select AI Topic...';
        conversationSelector.appendChild(defaultOption);

        // Get available topics from AI service
        const topics = window.aiDialogueService ? 
            window.aiDialogueService.getAvailableTopics() : 
            [
                'Daily Routines',
                'Food and Dining', 
                'Travel and Transportation',
                'Work and Career',
                'Family and Relationships'
            ];

        // Populate with AI topics
        topics.forEach((topic, index) => {
            const option = document.createElement('option');
            option.value = `ai-topic-${index}`;
            option.dataset.topic = topic;
            option.textContent = `AI: ${topic}`;
            conversationSelector.appendChild(option);
        });

        // Update event listener for AI mode
        conversationSelector.removeEventListener('change', this.originalChangeHandler);
        conversationSelector.addEventListener('change', (e) => {
            if (e.target.value.startsWith('ai-topic-')) {
                const topic = e.target.options[e.target.selectedIndex].dataset.topic;
                this.generateAIDialogue(topic);
            }
        });
    }

    async loadAIDialogue() {
        this.setLoading(true, 'Initializing AI dialogue system...');
        
        try {
            if (!window.aiDialogueService) {
                throw new Error('AI service not loaded. Please ensure ai-dialogue-service.js is included.');
            }

            // Check if API key is configured
            if (!window.aiDialogueService.isConfigured()) {
                const apiKeySet = await window.aiDialogueService.showApiKeyDialog();
                if (!apiKeySet) {
                    throw new Error('GROQ API key required for AI features. Please configure your API key.');
                }
            }

            // Start with a default topic if none selected
            const defaultTopic = 'Basic Introduction and Greetings';
            await this.generateAIDialogue(defaultTopic);
            
        } catch (error) {
            console.error('Error initializing AI dialogue:', error);
            this.showError(`Failed to initialize AI dialogue: ${error.message}. You can still use regular dialogues.`);
            
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

    async generateAIDialogue(topic) {
        this.setLoading(true, `Generating AI dialogue about "${topic}"...`);
        
        try {
            // Get a base dialogue from the existing data to enhance
            let baseDialogue = this.getRandomBaseDialogue();
            
            // Generate enhanced dialogue using AI
            const context = {
                language: this.currentLanguage || 'English',
                learnerLevel: 'intermediate',   // Could be made configurable
                focusArea: topic
            };

            let aiDialogue;
            if (baseDialogue) {
                // Enhance existing dialogue
                aiDialogue = await window.aiDialogueService.enhanceDialogue(baseDialogue, context);
            } else {
                // Generate completely new dialogue
                aiDialogue = await window.aiDialogueService.generateNewDialogue(topic, context);
            }

            // Use the AI generated dialogue
            this.originalDialogue = aiDialogue;
            
            // Process and display the dialogue
            this.processDialogue();
            this.populateConversationSelector(); 
            this.setCurrentConversation(0);

            // Update UI to show this is AI generated
            this.updateCurrentLanguageDisplay('English (AI Generated)');
            
        } catch (error) {
            console.error('AI dialogue generation failed:', error);
            
            // Fallback to base dialogue if AI fails
            if (this.getRandomBaseDialogue()) {
                Utils.showToast(`AI generation failed: ${error.message}. Using base dialogue.`, 'warning');
                this.originalDialogue = this.getRandomBaseDialogue();
                this.processDialogue();
                this.populateConversationSelector();
                this.setCurrentConversation(0);
            } else {
                this.showError(`Failed to generate AI dialogue: ${error.message}`);
            }
        } finally {
            this.setLoading(false);
        }
    }

    getRandomBaseDialogue() {
        try {
            if (typeof getDialogueForLanguage === 'undefined') {
                return null;
            }
            
            const dialogueText = getDialogueForLanguage('English');
            if (!dialogueText) return null;

            // Parse to get individual conversations
            const conversations = dialogueText.split(/Conversation \d+/).filter(conv => conv.trim());
            
            if (conversations.length === 0) return null;
            
            // Return a random conversation as base
            const randomIndex = Math.floor(Math.random() * conversations.length);
            return `Conversation 1${conversations[randomIndex]}`;
            
        } catch (error) {
            console.warn('Could not get base dialogue:', error);
            return null;
        }
    }

    updateCurrentLanguageDisplay(text) {
        const currentLanguageSpan = document.getElementById('current-language');
        if (currentLanguageSpan) {
            currentLanguageSpan.textContent = text;
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