// Learn Home Page JavaScript
class LearnHome {
    constructor() {
        this.learners = [];
        this.selectedLearners = [];
        this.groupMembers = []; // For group learning mode
        this.isGroupMode = false; // Track if in group learning mode
        this.dataTable = null;
        this.timerInterval = null;
        this.endTime = null;
        this.sessionEnded = false;
        this.timeEndedShown = false;
        this.init();
    }

    async init() {
        await this.loadLearners();
        this.setupEventListeners();
        this.initializeDataTable();
        this.updateCounts();
        // Update select-all checkbox after initialization
        setTimeout(() => {
            this.updateSelectAllCheckbox();
        }, 100);
        
        // Restore timer if exists in localStorage
        this.restoreSessionTimer();
        
        // Store instance globally for access from other modules
        window.learnHomeInstance = this;
        
        console.log('Learn Home initialized');
    }

    setupEventListeners() {
        // Add learner button
        const addBtn = document.getElementById('add-learner-btn');
        const learnerInput = document.getElementById('learner-input');
        
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addLearner());
        }

        // Enter key on input
        if (learnerInput) {
            learnerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addLearner();
                }
            });
        }

        // Start learning button
        const startBtn = document.getElementById('start-learning-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startLearning());
        }

        // Start with group button
        const startGroupBtn = document.getElementById('start-group-btn');
        if (startGroupBtn) {
            startGroupBtn.addEventListener('click', () => this.startGroupLearning());
        }

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.handleSelectAll(e.target.checked);
            });
        }

        // Popup event listeners
        this.setupPopupListeners();
        
        // Time input popup event listeners
        this.setupTimeInputListeners();
        
        // Group selection popup event listeners
        this.setupGroupSelectionListeners();
    }

    setupPopupListeners() {
        // Warning popup OK button
        const warningOkBtn = document.getElementById('warning-ok-btn');
        if (warningOkBtn) {
            warningOkBtn.addEventListener('click', () => {
                Utils.hidePopup('warning-popup');
            });
        }

        // Delete popup buttons
        const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
        const deleteCancelBtn = document.getElementById('delete-cancel-btn');
        
        if (deleteConfirmBtn) {
            deleteConfirmBtn.addEventListener('click', () => {
                this.confirmDelete();
            });
        }

        if (deleteCancelBtn) {
            deleteCancelBtn.addEventListener('click', () => {
                Utils.hidePopup('delete-popup');
                this.pendingDeleteId = null;
            });
        }

        // Time ended popup OK button
        const timeEndedOkBtn = document.getElementById('time-ended-ok-btn');
        if (timeEndedOkBtn) {
            timeEndedOkBtn.addEventListener('click', () => {
                Utils.hidePopup('time-ended-popup');
                // Clear session data
                this.clearSession();
                // Navigate back to home page
                if (app) {
                    app.showPage('home');
                }
            });
        }
    }

    setupTimeInputListeners() {
        // Time input popup buttons
        const timeConfirmBtn = document.getElementById('time-confirm-btn');
        const timeCancelBtn = document.getElementById('time-cancel-btn');
        
        if (timeConfirmBtn) {
            timeConfirmBtn.addEventListener('click', () => {
                this.confirmTimeInput();
            });
        }

        if (timeCancelBtn) {
            timeCancelBtn.addEventListener('click', () => {
                Utils.hidePopup('time-input-popup');
            });
        }
    }

    setupGroupSelectionListeners() {
        // Group selection popup buttons
        const groupStartBtn = document.getElementById('group-start-btn');
        const groupCancelBtn = document.getElementById('group-cancel-btn');
        const groupSelectAll = document.getElementById('group-select-all');
        
        if (groupStartBtn) {
            groupStartBtn.addEventListener('click', () => {
                this.confirmGroupSelection();
            });
        }

        if (groupCancelBtn) {
            groupCancelBtn.addEventListener('click', () => {
                Utils.hidePopup('group-selection-popup');
                this.groupMembers = [];
            });
        }

        if (groupSelectAll) {
            groupSelectAll.addEventListener('change', (e) => {
                this.handleGroupSelectAll(e.target.checked);
            });
        }
    }

    restoreSessionTimer() {
        // Check if there's an active session in localStorage
        const storedEndTime = localStorage.getItem('learningSessionEndTime');
        const storedSessionEnded = localStorage.getItem('learningSessionEnded');
        
        if (storedEndTime) {
            const endTime = new Date(storedEndTime);
            const now = new Date();
            
            console.log('Restoring session - Stored end time:', endTime, 'Current time:', now);
            
            // If session already ended, show popup immediately
            if (storedSessionEnded === 'true' || now >= endTime) {
                console.log('Session already ended, showing popup');
                this.sessionEnded = true;
                this.endTime = endTime; // Set endTime even for ended sessions
                this.endSession();
            } else {
                // Session is still active, restore timer
                console.log('Session still active, restoring timer');
                this.endTime = endTime;
                this.sessionEnded = false;
                this.timeEndedShown = false;
                this.startTimer();
            }
        } else {
            console.log('No stored session found');
        }
    }

    addLearner() {
        const input = document.getElementById('learner-input');
        const name = input.value.trim();

        if (!Utils.validateInput(name, 'name')) {
            Utils.showToast('Please enter a valid learner name (minimum 2 characters, letters only)', 'warning');
            return;
        }

        const formattedName = Utils.formatName(name);

        // Check for duplicates
        if (this.learners.some(learner => learner.name.toLowerCase() === formattedName.toLowerCase())) {
            Utils.showToast(`The name "${formattedName}" already exists. Please enter a unique name.`, 'error');
            return;
        }

        // Create new learner
        const newLearner = {
            id: Utils.generateId(),
            name: formattedName
        };

        this.learners.push(newLearner);
        
        // Automatically select the new learner for studies
        this.selectedLearners.push(newLearner.id);
        
        this.saveLearners();
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();

        // Clear input
        input.value = '';
        Utils.showToast(`${formattedName} added and selected for studies`, 'success');
    }

    deleteLearner(id) {
        console.log('Delete learner called with ID:', id);
        
        const learner = this.learners.find(l => l.id === id);
        if (!learner) {
            console.warn('Learner not found with ID:', id);
            Utils.showToast('Learner not found', 'error');
            return;
        }

        this.pendingDeleteId = id;
        const deleteMessage = document.getElementById('delete-message');
        if (deleteMessage) {
            deleteMessage.textContent = `Are you sure you want to delete "${learner.name}"?`;
        }
        
        console.log('Showing delete popup for:', learner.name);
        Utils.showPopup('delete-popup');
    }

    confirmDelete() {
        if (!this.pendingDeleteId) return;

        this.learners = this.learners.filter(learner => learner.id !== this.pendingDeleteId);
        this.selectedLearners = this.selectedLearners.filter(id => id !== this.pendingDeleteId);
        
        this.saveLearners();
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
        
        Utils.hidePopup('delete-popup');
        Utils.showToast('Learner deleted successfully', 'success');
        this.pendingDeleteId = null;
    }

    handleSelectLearner(id, isChecked) {
        if (isChecked) {
            if (!this.selectedLearners.includes(id)) {
                this.selectedLearners.push(id);
            }
        } else {
            this.selectedLearners = this.selectedLearners.filter(selectedId => selectedId !== id);
        }
        
        this.saveSelectedLearners();
        this.updateCounts();
        this.updateSelectAllCheckbox();
    }

    handleSelectAll(isChecked) {
        if (isChecked) {
            this.selectedLearners = this.learners.map(learner => learner.id);
        } else {
            this.selectedLearners = [];
        }
        
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = this.learners.length > 0 && 
                                       this.selectedLearners.length === this.learners.length;
        }
    }

    startLearning() {
        if (this.selectedLearners.length === 0) {
            const warningMessage = document.getElementById('warning-message');
            if (warningMessage) {
                warningMessage.textContent = 'Please select at least one learner to start learning.';
            }
            Utils.showPopup('warning-popup');
            return;
        }

        // Set to regular mode (not group mode)
        this.isGroupMode = false;
        this.groupMembers = [];

        // Show time input popup
        Utils.showPopup('time-input-popup');
        
        // Set default times (current time for start, 1 hour later for end)
        const now = new Date();
        const startTime = this.formatTimeInput(now);
        const endTime = this.formatTimeInput(new Date(now.getTime() + 60 * 60 * 1000)); // 1 hour later
        
        const startTimeInput = document.getElementById('start-time-input');
        const endTimeInput = document.getElementById('end-time-input');
        
        if (startTimeInput) {
            startTimeInput.value = startTime;
        }
        if (endTimeInput) {
            endTimeInput.value = endTime;
        }
    }

    startGroupLearning() {
        if (this.learners.length === 0) {
            const warningMessage = document.getElementById('warning-message');
            if (warningMessage) {
                warningMessage.textContent = 'Please add learners first before starting group learning.';
            }
            Utils.showPopup('warning-popup');
            return;
        }

        // Reset group members
        this.groupMembers = [];
        
        // Populate group members list
        this.populateGroupMembersList();
        
        // Show group selection popup
        Utils.showPopup('group-selection-popup');
    }

    populateGroupMembersList() {
        const groupMembersList = document.getElementById('group-members-list');
        if (!groupMembersList) return;

        // Clear existing list
        groupMembersList.innerHTML = '';

        // Create checkbox for each learner
        this.learners.forEach(learner => {
            const memberDiv = document.createElement('div');
            memberDiv.style.cssText = 'padding: 0.5rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `group-member-${learner.id}`;
            checkbox.className = 'group-member-checkbox';
            checkbox.dataset.id = learner.id;
            checkbox.style.cssText = 'margin-right: 0.75rem; width: 18px; height: 18px; cursor: pointer;';
            
            const label = document.createElement('label');
            label.htmlFor = `group-member-${learner.id}`;
            label.textContent = learner.name;
            label.style.cssText = 'cursor: pointer; flex: 1; font-size: 1rem;';
            
            checkbox.addEventListener('change', (e) => {
                this.handleGroupMemberToggle(learner.id, e.target.checked);
            });
            
            memberDiv.appendChild(checkbox);
            memberDiv.appendChild(label);
            groupMembersList.appendChild(memberDiv);
        });

        // Update count
        this.updateGroupSelectedCount();
    }

    handleGroupMemberToggle(id, isChecked) {
        if (isChecked) {
            if (!this.groupMembers.includes(id)) {
                this.groupMembers.push(id);
            }
        } else {
            this.groupMembers = this.groupMembers.filter(memberId => memberId !== id);
        }
        
        this.updateGroupSelectedCount();
        this.updateGroupSelectAllCheckbox();
    }

    handleGroupSelectAll(isChecked) {
        const checkboxes = document.querySelectorAll('.group-member-checkbox');
        
        if (isChecked) {
            this.groupMembers = this.learners.map(learner => learner.id);
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
        } else {
            this.groupMembers = [];
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        this.updateGroupSelectedCount();
    }

    updateGroupSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('group-select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = this.learners.length > 0 && 
                                       this.groupMembers.length === this.learners.length;
        }
    }

    updateGroupSelectedCount() {
        const countElement = document.getElementById('group-selected-count');
        if (countElement) {
            countElement.textContent = `${this.groupMembers.length} selected`;
        }
    }

    confirmGroupSelection() {
        if (this.groupMembers.length === 0) {
            Utils.showToast('Please select at least one member for group learning', 'warning');
            return;
        }

        // Hide group selection popup
        Utils.hidePopup('group-selection-popup');

        // Set to group mode
        this.isGroupMode = true;

        // Show time input popup (same as regular learning)
        Utils.showPopup('time-input-popup');
        
        // Set default times (current time for start, 1 hour later for end)
        const now = new Date();
        const startTime = this.formatTimeInput(now);
        const endTime = this.formatTimeInput(new Date(now.getTime() + 60 * 60 * 1000)); // 1 hour later
        
        const startTimeInput = document.getElementById('start-time-input');
        const endTimeInput = document.getElementById('end-time-input');
        
        if (startTimeInput) {
            startTimeInput.value = startTime;
        }
        if (endTimeInput) {
            endTimeInput.value = endTime;
        }
    }

    formatTimeInput(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    confirmTimeInput() {
        const startTimeInput = document.getElementById('start-time-input');
        const endTimeInput = document.getElementById('end-time-input');
        
        if (!startTimeInput || !endTimeInput) {
            Utils.showToast('Time inputs not found', 'error');
            return;
        }

        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (!startTime || !endTime) {
            Utils.showToast('Please enter both start and end times', 'warning');
            return;
        }

        // Parse times
        const now = new Date();
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);

        const startDate = new Date(now);
        startDate.setHours(startHours, startMinutes, 0, 0);

        const endDate = new Date(now);
        endDate.setHours(endHours, endMinutes, 0, 0);

        // If end time is earlier than start time, assume it's next day
        if (endDate <= startDate) {
            endDate.setDate(endDate.getDate() + 1);
        }

        // Validate times
        if (endDate <= startDate) {
            Utils.showToast('End time must be after start time', 'warning');
            return;
        }

        // Check if end time is in the past
        if (endDate <= now) {
            Utils.showToast('End time must be in the future', 'warning');
            return;
        }

        console.log('=== Starting New Session ===');
        console.log('Start time:', startDate);
        console.log('End time:', endDate);
        console.log('Current time:', now);
        console.log('Duration:', Math.floor((endDate - now) / 1000), 'seconds');

        // Reset session state
        this.sessionEnded = false;
        this.timeEndedShown = false;
        
        // Store end time FIRST before starting timer
        this.endTime = endDate;
        
        console.log('this.endTime set to:', this.endTime);
        
        // Save to localStorage for persistence across page refreshes
        localStorage.setItem('learningSessionEndTime', endDate.toISOString());
        localStorage.setItem('learningSessionEnded', 'false');
        
        console.log('Saved to localStorage:', localStorage.getItem('learningSessionEndTime'));
        
        // Start the timer
        this.startTimer();

        // Hide popup and navigate to dialogue page
        Utils.hidePopup('time-input-popup');
        
        if (app) {
            app.showPage('dialogue');
            
            // Initialize dialogue page with appropriate learners (group or selected)
            if (window.dialoguePage) {
                const learnerNames = this.isGroupMode ? this.getGroupMemberNames() : this.getSelectedLearnerNames();
                window.dialoguePage.initializeWithLearners(learnerNames, this.isGroupMode);
            }
        }

        const endTimeStr = this.formatTimeInput(endDate);
        const modeText = this.isGroupMode ? 'Group learning' : 'Learning';
        Utils.showToast(`${modeText} session started. End time: ${endTimeStr}`, 'success');
    }

    startTimer() {
        // Clear any existing timer
        this.clearTimer();

        if (!this.endTime) {
            console.error('Cannot start timer: endTime is not set');
            return;
        }

        console.log('Starting session timer. End time:', this.endTime);

        // Check every second if end time is reached
        this.timerInterval = setInterval(() => {
            const now = new Date();
            
            if (!this.endTime) {
                console.error('Timer running but endTime is null, clearing timer');
                this.clearTimer();
                return;
            }
            
            const timeRemaining = this.endTime.getTime() - now.getTime();
            
            console.log('Timer check - Now:', now.toLocaleTimeString(), 
                       'End:', this.endTime.toLocaleTimeString(), 
                       'Remaining:', Math.floor(timeRemaining / 1000), 'seconds');
            
            // Check if session has ended
            if (now >= this.endTime && !this.sessionEnded) {
                console.log('⏰ Session time reached! Ending session...');
                this.sessionEnded = true;
                this.endSession();
            }
        }, 1000);
        
        // Store timer reference globally to prevent garbage collection
        window.learningTimerInterval = this.timerInterval;
        window.learningEndTime = this.endTime;
    }

    endSession() {
        console.log('Ending learning session...');
        
        // Mark session as ended in localStorage
        localStorage.setItem('learningSessionEnded', 'true');
        
        // Clear the timer
        this.clearTimer();
        
        // Play beep sound
        this.playBeepSound();
        
        // Stop any ongoing dialogue/conversation
        if (window.dialoguePage) {
            window.dialoguePage.stopAutoAdvance?.();
        }
        
        // Show time ended popup (only once)
        if (!this.timeEndedShown) {
            this.timeEndedShown = true;
            setTimeout(() => {
                Utils.showPopup('time-ended-popup');
            }, 500); // Small delay to ensure beep plays first
        }
    }

    playBeepSound() {
        // Create audio context for beep sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Play beep 3 times with intervals
            this.playSingleBeep(audioContext, 0);
            this.playSingleBeep(audioContext, 600);
            this.playSingleBeep(audioContext, 1200);
        } catch (error) {
            console.error('Error playing beep sound:', error);
            // Fallback: try using HTML5 audio
            this.playBeepFallback();
        }
    }

    playSingleBeep(audioContext, delay) {
        setTimeout(() => {
            try {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                // Beep sound settings
                oscillator.frequency.value = 800; // Frequency in Hz
                oscillator.type = 'sine';

                const currentTime = audioContext.currentTime;
                gainNode.gain.setValueAtTime(0.3, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.5);

                oscillator.start(currentTime);
                oscillator.stop(currentTime + 0.5);
            } catch (error) {
                console.error('Error playing single beep:', error);
            }
        }, delay);
    }

    playBeepFallback() {
        // Fallback: Create a simple beep using Web Audio API with a simpler approach
        try {
            // Try to create a simple tone using AudioContext
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
            
            // Play 2 more beeps
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                osc2.frequency.value = 800;
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                osc2.start();
                osc2.stop(audioContext.currentTime + 0.3);
            }, 400);
            
            setTimeout(() => {
                const osc3 = audioContext.createOscillator();
                const gain3 = audioContext.createGain();
                osc3.connect(gain3);
                gain3.connect(audioContext.destination);
                osc3.frequency.value = 800;
                osc3.type = 'sine';
                gain3.gain.setValueAtTime(0.3, audioContext.currentTime);
                gain3.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                osc3.start();
                osc3.stop(audioContext.currentTime + 0.3);
            }, 800);
        } catch (error) {
            console.error('Error playing fallback beep:', error);
        }
    }

    clearTimer() {
        console.log('Clearing timer...');
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (window.learningTimerInterval) {
            clearInterval(window.learningTimerInterval);
            window.learningTimerInterval = null;
        }
        // Don't set endTime to null here - we need it for the popup
        // this.endTime = null;
    }

    clearSession() {
        // Clear all session data
        console.log('Clearing session completely');
        this.clearTimer();
        this.endTime = null;
        this.sessionEnded = false;
        this.timeEndedShown = false;
        localStorage.removeItem('learningSessionEndTime');
        localStorage.removeItem('learningSessionEnded');
        window.learningEndTime = null;
    }

    isSessionActive() {
        return this.endTime !== null && !this.sessionEnded;
    }

    isSessionEnded() {
        return this.sessionEnded;
    }

    getSelectedLearnerNames() {
        return this.learners
            .filter(learner => this.selectedLearners.includes(learner.id))
            .map(learner => learner.name);
    }

    getGroupMemberNames() {
        return this.learners
            .filter(learner => this.groupMembers.includes(learner.id))
            .map(learner => learner.name);
    }

    getActiveLearnerNames() {
        // Returns the active learner names based on mode (group or regular)
        return this.isGroupMode ? this.getGroupMemberNames() : this.getSelectedLearnerNames();
    }

    initializeDataTable() {
        const table = document.getElementById('learners-table');
        if (!table || !$) return;

        this.dataTable = $(table).DataTable({
            data: [],
            columns: [
                {
                    title: '<input type="checkbox" id="select-all">',
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    width: '60px',
                    render: (data, type, row) => {
                        const checked = this.selectedLearners.includes(row.id) ? 'checked' : '';
                        return `<input type="checkbox" class="learner-checkbox" data-id="${row.id}" ${checked}>`;
                    }
                },
                {
                    title: 'Name',
                    data: 'name',
                    className: 'learner-name-cell'
                },
                {
                    title: 'Actions',
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    width: '80px',
                    render: (data, type, row) => {
                        return `<i data-lucide="trash-2" class="delete-icon" data-id="${row.id}" title="Delete learner"></i>`;
                    }
                }
            ],
            pageLength: 10,
            responsive: true,
            language: {
                emptyTable: "No learners added yet. Add some learners to get started!",
                zeroRecords: "No learners found matching your search.",
                search: "Search learners:",
                lengthMenu: "Show _MENU_ learners per page",
                info: "Showing _START_ to _END_ of _TOTAL_ learners",
                infoEmpty: "No learners to show",
                infoFiltered: "(filtered from _MAX_ total learners)"
            },
            drawCallback: () => {
                // Reinitialize icons and event listeners after table redraw
                this.initializeTableEvents();
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        });

        this.refreshTable();
    }

    initializeTableEvents() {
        // Remove existing event listeners to prevent duplicates
        $('#learners-table').off('change', '.learner-checkbox');
        $('#learners-table').off('click', '.delete-icon');
        
        // Use event delegation for better compatibility with DataTables
        $('#learners-table').on('change', '.learner-checkbox', (e) => {
            const id = e.target.getAttribute('data-id');
            if (id) {
            this.handleSelectLearner(id, e.target.checked);
            }
        });

        // Delete button events with event delegation
        $('#learners-table').on('click', '.delete-icon', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const target = e.target;
            const id = target.getAttribute('data-id') || 
                      target.closest('[data-id]')?.getAttribute('data-id');
            
            if (id) {
                console.log('Delete button clicked for ID:', id);
                this.deleteLearner(id);
            } else {
                console.warn('No ID found for delete button');
            }
        });

        // Handle select all checkbox
        $('#select-all').off('change').on('change', (e) => {
            this.handleSelectAll(e.target.checked);
        });

        // Update select all checkbox state
        this.updateSelectAllCheckbox();
    }

    refreshTable() {
        if (this.dataTable) {
            this.dataTable.clear().rows.add(this.learners).draw();
        }
    }

    updateCounts() {
        const totalElement = document.getElementById('total-learners');
        const selectedElement = document.getElementById('selected-learners');
        
        if (totalElement) {
            totalElement.textContent = this.learners.length;
        }
        
        if (selectedElement) {
            selectedElement.textContent = this.selectedLearners.length;
        }
    }

    async loadLearners() {
        this.learners = Utils.getFromStorage('learners', []);
        this.selectedLearners = Utils.getFromStorage('selectedLearners', []);
        
        // If no learners exist in storage, load default learners from JSON
        if (this.learners.length === 0) {
            await this.loadDefaultLearners();
        }
        
        // Clean up selected learners (remove IDs that no longer exist)
        this.selectedLearners = this.selectedLearners.filter(id =>
            this.learners.some(learner => learner.id === id)
        );
        
        // If no learners are selected but learners exist,
        // select all by default
        if (this.selectedLearners.length === 0 && this.learners.length > 0) {
            this.selectedLearners = this.learners.map(learner => learner.id);
        }
        
        this.saveSelectedLearners();
    }

    async loadDefaultLearners() {
        try {
            // Fetch default learners from JSON file
            const response = await fetch('js/default-learners.json');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch default learners: ${response.status}`);
            }
            
            const data = await response.json();
            const defaultNames = data.learners || [];
            
            if (!Array.isArray(defaultNames) || defaultNames.length === 0) {
                console.warn('No default learners found in JSON file');
                return;
            }

            // Create learner objects from default names
            this.learners = defaultNames.map(name => ({
                id: Utils.generateId(),
                name: Utils.formatName(name.trim())
            }));

            // Select all default learners by default
            this.selectedLearners = this.learners.map(learner => learner.id);

            // Save to storage
            this.saveLearners();
            this.saveSelectedLearners();

            console.log(`Loaded ${this.learners.length} default learners from JSON, all selected by default`);
        } catch (error) {
            console.error('Error loading default learners from JSON:', error);
            
            // Fallback to JavaScript constant if available (for backward compatibility)
            if (typeof DEFAULT_LEARNERS !== 'undefined' && Array.isArray(DEFAULT_LEARNERS)) {
                console.log('Falling back to JavaScript DEFAULT_LEARNERS constant');
                this.learners = DEFAULT_LEARNERS.map(name => ({
                    id: Utils.generateId(),
                    name: Utils.formatName(name.trim())
                }));
                this.selectedLearners = this.learners.map(learner => learner.id);
                this.saveLearners();
                this.saveSelectedLearners();
                console.log(`Loaded ${this.learners.length} default learners from JavaScript constant`);
            } else {
                console.warn('No default learners available');
            }
        }
    }

    saveLearners() {
        Utils.saveToStorage('learners', this.learners);
    }

    saveSelectedLearners() {
        Utils.saveToStorage('selectedLearners', this.selectedLearners);
    }

    // Public methods for external access
    getLearners() {
        return this.learners;
    }

    getSelectedLearners() {
        return this.selectedLearners;
    }

    setSelectedLearners(ids) {
        this.selectedLearners = ids.filter(id =>
            this.learners.some(learner => learner.id === id)
        );
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearnHome;
} 