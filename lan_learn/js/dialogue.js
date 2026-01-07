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
        
        // Audio
        this.synthesis = null;
        this.currentUtterance = null;
        this.isPlaying = false;
        this.isCommunicationEnabled = false;
        
        // Microphone recording
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordedAudio = null;
        this.currentRecordingLineIndex = null;
        this.audioStream = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeSpeechSynthesis();
        console.log('Dialogue Page initialized');
    }

    initializeSpeechSynthesis() {
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
        } else {
            console.warn('Speech synthesis not supported');
        }
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

        // Enable/Disable communication buttons
        const enableBtn = document.getElementById('enable-communication-btn');
        const disableBtn = document.getElementById('disable-communication-btn');
        
        if (enableBtn) {
            enableBtn.addEventListener('click', () => this.enableCommunication());
        }
        
        if (disableBtn) {
            disableBtn.addEventListener('click', () => this.disableCommunication());
        }
    }

    async initializeWithLearners(learnerNames) {
        this.learnerNames = learnerNames || [];
        if (this.learnerNames.length === 0) {
            this.showError('No learners selected. Please go back and select learners.');
            return;
        }

        // Display group info
        this.displayGroupInfo();
        
        await this.loadDialogue();
    }

    displayGroupInfo() {
        const learnersList = document.getElementById('group-learners-list');
        const learnersCount = document.getElementById('group-learners-count');
        
        if (learnersList) {
            learnersList.innerHTML = '';
            this.learnerNames.forEach(name => {
                const badge = document.createElement('span');
                badge.className = 'learner-badge';
                badge.textContent = name;
                learnersList.appendChild(badge);
            });
        }
        
        if (learnersCount) {
            learnersCount.textContent = this.learnerNames.length;
        }
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async loadDialogue() {
        this.setLoading(true);
        
        try {
            if (typeof getDialogueForLanguage === 'undefined') {
                throw new Error('Dialogue data not loaded. Please ensure dialogue-data.js is included.');
            }
            
            const dialogueText = getDialogueForLanguage(this.currentLanguage);
            
            if (!dialogueText || dialogueText.trim() === '') {
                throw new Error(`No dialogue content found for language: ${this.currentLanguage}`);
            }

            this.originalDialogue = dialogueText;
            
            await this.applyTranslation();
            
            this.processDialogue();
            this.populateConversationSelector();
            this.setCurrentConversation(0);
            
        } catch (error) {
            console.error('Error loading dialogue:', error);
            this.showError(`Failed to load dialogue script for ${this.currentLanguage}. Available languages: ${getAvailableLanguages().join(', ')}`);
            
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
                    console.log(`Translation will be applied for language: ${currentLang}`);
                    
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

                while (attempts < maxAttempts) {
                    const candidate = getRandomName();
                    attempts++;

                    if (!recentlyUsedNames.includes(candidate)) {
                        assignedName = candidate;
                        break;
                    }
                }

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
        
        // Attach event listeners to speak buttons
        this.attachSpeakButtonListeners();
        
        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    attachSpeakButtonListeners() {
        const speakButtons = document.querySelectorAll('.speak-btn');
        speakButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const lineIndex = parseInt(e.target.closest('.speak-btn').getAttribute('data-line-index'));
                this.speakDialogToGroup(lineIndex);
            });
        });
    }

    renderHighlightedDialogue(dialogue) {
        const lines = dialogue.split('\n');
        return lines.map((line, index) => {
            const isHighlighted = index === this.currentLineIndex;
            const isRecording = this.isRecording && this.currentRecordingLineIndex === index;
            const className = isHighlighted ? 'highlighted-line' : '';
            const id = isHighlighted ? 'highlighted-line' : '';
            const recordingClass = isRecording ? 'recording-line' : '';
            
            // Check if line has learner-name (is a dialog)
            const hasDialog = line.includes('learner-name');
            
            // Add speak button if communication is enabled and line has dialog
            let speakButton = '';
            if (this.isCommunicationEnabled && hasDialog) {
                const buttonText = isRecording ? 'Stop Recording' : 'Speak';
                const buttonIcon = isRecording ? 'mic-off' : 'mic';
                const buttonClass = isRecording ? 'speak-btn recording' : 'speak-btn';
                speakButton = `<button class="${buttonClass}" data-line-index="${index}" title="Speak this dialog to group">
                    <i data-lucide="${buttonIcon}"></i>
                    <span>${buttonText}</span>
                </button>`;
            }
            
            return `<div class="dialogue-line ${className} ${recordingClass}" id="${id}">
                ${line}
                ${speakButton}
            </div>`;
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

    enableCommunication() {
        this.isCommunicationEnabled = true;
        
        // Toggle buttons
        const enableBtn = document.getElementById('enable-communication-btn');
        const disableBtn = document.getElementById('disable-communication-btn');
        const statusDiv = document.getElementById('communication-status');
        
        if (enableBtn) enableBtn.style.display = 'none';
        if (disableBtn) disableBtn.style.display = 'flex';
        if (statusDiv) statusDiv.style.display = 'flex';
        
        // Refresh conversation to show speak buttons
        this.displayConversation();
        
        Utils.showToast('Group communication enabled! Click speak button on any dialog to share with group.', 'success');
    }
    
    disableCommunication() {
        this.isCommunicationEnabled = false;
        
        // Stop any playing audio
        this.stopAudio();
        
        // Stop any ongoing recording
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Stop audio stream if active
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        // Toggle buttons
        const enableBtn = document.getElementById('enable-communication-btn');
        const disableBtn = document.getElementById('disable-communication-btn');
        const statusDiv = document.getElementById('communication-status');
        
        if (enableBtn) enableBtn.style.display = 'flex';
        if (disableBtn) disableBtn.style.display = 'none';
        if (statusDiv) statusDiv.style.display = 'none';
        
        // Refresh conversation to hide speak buttons
        this.displayConversation();
        
        Utils.showToast('Group communication disabled.', 'info');
    }
    
    async speakDialogToGroup(lineIndex) {
        if (!this.isCommunicationEnabled) {
            return;
        }
        
        // If already recording, stop it first
        if (this.isRecording) {
            this.stopRecording();
            return;
        }
        
        if (this.currentConversationIndex >= this.modifiedDialogue.length) {
            return;
        }

        const conversation = this.modifiedDialogue[this.currentConversationIndex];
        const lines = conversation.split('\n');
        const dialogLine = lines[lineIndex];

        if (!dialogLine || !dialogLine.includes('learner-name')) {
            return;
        }

        // Store the line index for reference
        this.currentRecordingLineIndex = lineIndex;
        
        // Start microphone recording
        await this.startMicrophoneRecording(lineIndex);
    }
    
    async startMicrophoneRecording(lineIndex) {
        try {
            // Request microphone access
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(this.audioStream);
            this.audioChunks = [];
            this.isRecording = true;

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // Create audio element and play it to the group
                this.recordedAudio = new Audio(audioUrl);
                this.playRecordedAudioToGroup();
                
                // Stop all tracks
                if (this.audioStream) {
                    this.audioStream.getTracks().forEach(track => track.stop());
                    this.audioStream = null;
                }
            };

            this.mediaRecorder.start();
            this.updateSpeakButton(lineIndex, true);
            
            // Show dialog text as reference
            const conversation = this.modifiedDialogue[this.currentConversationIndex];
            const lines = conversation.split('\n');
            const dialogLine = lines[lineIndex];
            
            // Extract text for reference
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = dialogLine;
            const text = tempDiv.textContent || tempDiv.innerText || '';
            
            Utils.showToast(`Recording... Speak: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`, 'info');
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            Utils.showToast('Microphone access denied or not available. Please allow microphone access.', 'error');
            this.isRecording = false;
            this.currentRecordingLineIndex = null;
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            if (this.currentRecordingLineIndex !== null) {
                this.updateSpeakButton(this.currentRecordingLineIndex, false);
                this.currentRecordingLineIndex = null;
            }
            
            Utils.showToast('Recording stopped. Playing to group...', 'info');
        }
    }
    
    playRecordedAudioToGroup() {
        if (!this.recordedAudio) return;

        // Stop any current audio
        this.stopAudio();

        this.recordedAudio.onplay = () => {
            this.isPlaying = true;
            Utils.showToast(`Playing your voice to group (${this.learnerNames.length} learners)...`, 'info');
        };

        this.recordedAudio.onended = () => {
            this.isPlaying = false;
            Utils.showToast('Voice shared with group successfully!', 'success');
            
            // Clean up
            if (this.recordedAudio) {
                URL.revokeObjectURL(this.recordedAudio.src);
                this.recordedAudio = null;
            }
        };

        this.recordedAudio.onerror = (error) => {
            console.error('Audio playback error:', error);
            this.isPlaying = false;
            Utils.showToast('Error playing recorded audio', 'error');
        };

        // Play the recorded audio (shared with all group members)
        this.recordedAudio.play().catch(error => {
            console.error('Error playing audio:', error);
            Utils.showToast('Error playing audio', 'error');
        });
    }
    
    updateSpeakButton(lineIndex, isRecording) {
        // Refresh the conversation display to update visual indicators
        this.displayConversation();
        
        // Also update the button directly for immediate feedback
        const speakBtn = document.querySelector(`.speak-btn[data-line-index="${lineIndex}"]`);
        if (speakBtn) {
            const icon = speakBtn.querySelector('i');
            const span = speakBtn.querySelector('span');
            
            if (isRecording) {
                speakBtn.classList.add('recording');
                if (icon) icon.setAttribute('data-lucide', 'mic-off');
                if (span) span.textContent = 'Stop Recording';
            } else {
                speakBtn.classList.remove('recording');
                if (icon) icon.setAttribute('data-lucide', 'mic');
                if (span) span.textContent = 'Speak';
            }
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    playText(text) {
        if (!this.synthesis) {
            Utils.showToast('Speech synthesis not supported in this browser', 'error');
            return;
        }

        // Stop any current audio
        this.stopAudio();

        // Create new utterance
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice
        this.currentUtterance.rate = 0.9;
        this.currentUtterance.pitch = 1;
        this.currentUtterance.volume = 1;
        
        // Set language based on current language
        if (this.currentLanguage === 'English') {
            this.currentUtterance.lang = 'en-US';
        }

        // Event handlers
        this.currentUtterance.onstart = () => {
            this.isPlaying = true;
            if (this.isCommunicationEnabled) {
                Utils.showToast(`Playing dialog to group (${this.learnerNames.length} learners)...`, 'info');
            }
        };

        this.currentUtterance.onend = () => {
            this.isPlaying = false;
            if (this.isCommunicationEnabled) {
                Utils.showToast('Dialog shared with group successfully!', 'success');
            }
        };

        this.currentUtterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            this.isPlaying = false;
            Utils.showToast('Error playing audio', 'error');
        };

        // Play the audio (shared with all group members)
        this.synthesis.speak(this.currentUtterance);
    }

    stopAudio() {
        if (this.synthesis && this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        
        if (this.recordedAudio) {
            this.recordedAudio.pause();
            this.recordedAudio.currentTime = 0;
        }
        
        this.isPlaying = false;
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
