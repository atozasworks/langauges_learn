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
        
        // Update conversation selector
        const selector = document.getElementById('conversation-selector');
        if (selector) {
            selector.value = index;
        }

        // Display the conversation
        this.displayConversation();
        
        // Set current line to first learner line
        this.setFirstLearnerLine();
        
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
        const highlightedLine = document.getElementById('highlighted-line');
        if (highlightedLine) {
            highlightedLine.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
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

    setLoading(loading) {
        this.isLoading = loading;
        const scriptText = document.getElementById('script-text');
        
        if (scriptText) {
            if (loading) {
                scriptText.innerHTML = '<div class="loading">Loading dialogue...</div>';
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