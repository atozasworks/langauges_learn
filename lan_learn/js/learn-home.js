// Learn Home Page JavaScript — User-specific Learning Team (API-backed)
class LearnHome {
    constructor() {
        this.learners = [];
        this.selectedLearners = [];
        this.dataTable = null;
        this.loggedInUser = null; // { name, email }
        this.init();
    }

    async init() {
        this.resolveLoggedInUser();
        this.setupEventListeners();
        this.initializeDataTable();

        if (this.loggedInUser) {
            await this.loadLearnersFromServer();
        } else {
            this.showLoginRequiredState();
        }

        this.updateCounts();
        setTimeout(() => this.updateSelectAllCheckbox(), 100);

        // Listen for login / logout events dispatched by login-modal.js
        window.addEventListener('userLogin', (e) => this.onUserLogin(e.detail));
        window.addEventListener('userLogout', () => this.onUserLogout());

        console.log('Learn Home initialized');
    }

    // ─── Auth helpers ───────────────────────────────────

    resolveLoggedInUser() {
        try {
            const raw = sessionStorage.getItem('loggedInUser');
            if (raw) {
                const u = JSON.parse(raw);
                if (u && u.email) {
                    this.loggedInUser = u;
                }
            }
        } catch (_) {}
    }

    async onUserLogin(detail) {
        this.loggedInUser = detail; // { name, email }
        this.hideLoginRequiredState();
        await this.loadLearnersFromServer();
        this.refreshTable();
        this.updateCounts();
    }

    onUserLogout() {
        this.loggedInUser = null;
        this.learners = [];
        this.selectedLearners = [];
        this.refreshTable();
        this.updateCounts();
        this.showLoginRequiredState();

        // Stop any running dialogue session and go back to home
        window.dialoguePage?.stopAutoAdvance?.();
        if (app) app.showPage('home');
    }

    showLoginRequiredState() {
        const input = document.getElementById('learner-input');
        const addBtn = document.getElementById('add-learner-btn');
        const startBtn = document.getElementById('start-learning-btn');
        if (input) { input.disabled = true; input.placeholder = 'Login first to manage your team'; }
        if (addBtn) addBtn.disabled = true;
        if (startBtn) startBtn.disabled = true;

        // Show login prompt inside empty table area
        if (this.dataTable) {
            this.dataTable.clear().draw();
        }
    }

    hideLoginRequiredState() {
        const input = document.getElementById('learner-input');
        const addBtn = document.getElementById('add-learner-btn');
        const startBtn = document.getElementById('start-learning-btn');
        if (input) { input.disabled = false; input.placeholder = "Enter Learner's Name"; }
        if (addBtn) addBtn.disabled = false;
        if (startBtn) startBtn.disabled = false;
    }

    // ─── Event listeners ────────────────────────────────

    setupEventListeners() {
        const addBtn = document.getElementById('add-learner-btn');
        const learnerInput = document.getElementById('learner-input');

        if (addBtn) addBtn.addEventListener('click', () => this.addLearner());
        if (learnerInput) {
            learnerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addLearner();
            });
        }

        const startBtn = document.getElementById('start-learning-btn');
        if (startBtn) startBtn.addEventListener('click', () => this.startLearning());

        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e.target.checked));
        }

        this.setupPopupListeners();
    }

    setupPopupListeners() {
        const warningOkBtn = document.getElementById('warning-ok-btn');
        if (warningOkBtn) warningOkBtn.addEventListener('click', () => Utils.hidePopup('warning-popup'));

        const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
        const deleteCancelBtn = document.getElementById('delete-cancel-btn');

        if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', () => this.confirmDelete());
        if (deleteCancelBtn) {
            deleteCancelBtn.addEventListener('click', () => {
                Utils.hidePopup('delete-popup');
                this.pendingDeleteId = null;
            });
        }
    }

    // ─── Add / Delete learners (API-backed) ─────────────

    async addLearner() {
        if (!this.loggedInUser) {
            Utils.showToast('Please login first to add learners.', 'warning');
            return;
        }

        const input = document.getElementById('learner-input');
        const name = input.value.trim();

        if (!Utils.validateInput(name, 'name')) {
            Utils.showToast('Please enter a valid learner name (minimum 2 characters, letters only)', 'warning');
            return;
        }

        const formattedName = Utils.formatName(name);

        // Local duplicate check
        if (this.learners.some(l => l.name.toLowerCase() === formattedName.toLowerCase())) {
            Utils.showToast(`"${formattedName}" already exists in your team.`, 'error');
            return;
        }

        try {
            const res = await fetch('./auth-backend/add-learner.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.loggedInUser.email, name: formattedName })
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                Utils.showToast(data.message || 'Failed to add learner.', 'error');
                return;
            }

            const newLearner = data.learner; // { id, name }
            this.learners.push(newLearner);
            this.selectedLearners.push(newLearner.id);
            this.saveSelectedLearners();
            this.refreshTable();
            this.updateCounts();
            input.value = '';
            Utils.showToast(`${newLearner.name} added and selected for studies`, 'success');
        } catch (err) {
            console.error('Add learner error:', err);
            Utils.showToast('Server error while adding learner.', 'error');
        }
    }

    deleteLearner(id) {
        const learner = this.learners.find(l => l.id === id);
        if (!learner) {
            Utils.showToast('Learner not found', 'error');
            return;
        }

        this.pendingDeleteId = id;
        const deleteMessage = document.getElementById('delete-message');
        if (deleteMessage) deleteMessage.textContent = `Are you sure you want to delete "${learner.name}"?`;
        Utils.showPopup('delete-popup');
    }

    async confirmDelete() {
        if (!this.pendingDeleteId || !this.loggedInUser) return;

        const id = this.pendingDeleteId;

        try {
            const res = await fetch('./auth-backend/delete-learner.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.loggedInUser.email, learner_id: id })
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                Utils.showToast(data.message || 'Failed to delete learner.', 'error');
                Utils.hidePopup('delete-popup');
                this.pendingDeleteId = null;
                return;
            }

            this.learners = this.learners.filter(l => l.id !== id);
            this.selectedLearners = this.selectedLearners.filter(sid => sid !== id);
            this.saveSelectedLearners();
            this.refreshTable();
            this.updateCounts();
            Utils.hidePopup('delete-popup');
            Utils.showToast('Learner deleted successfully', 'success');
        } catch (err) {
            console.error('Delete learner error:', err);
            Utils.showToast('Server error while deleting learner.', 'error');
        }

        this.pendingDeleteId = null;
    }

    handleSelectLearner(id, isChecked) {
        const numId = typeof id === 'string' ? parseInt(id, 10) : id;

        if (isChecked) {
            if (!this.selectedLearners.includes(numId)) this.selectedLearners.push(numId);
        } else {
            this.selectedLearners = this.selectedLearners.filter(sid => sid !== numId);
        }
        
        this.saveSelectedLearners();
        this.updateCounts();
        this.updateSelectAllCheckbox();
    }

    handleSelectAll(isChecked) {
        this.selectedLearners = isChecked ? this.learners.map(l => l.id) : [];
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
    }

    updateSelectAllCheckbox() {
        const cb = document.getElementById('select-all');
        if (cb) cb.checked = this.learners.length > 0 && this.selectedLearners.length === this.learners.length;
    }

    startLearning() {
        if (!this.loggedInUser) {
            Utils.showToast('Please login first.', 'warning');
            return;
        }

        if (this.selectedLearners.length === 0) {
            const warningMessage = document.getElementById('warning-message');
            if (warningMessage) warningMessage.textContent = 'Please select at least one learner to start learning.';
            Utils.showPopup('warning-popup');
            return;
        }

        if (app) {
            app.showPage('dialogue');
            if (window.dialoguePage) {
                window.dialoguePage.initializeWithLearners(this.getSelectedLearnerNames());
            }
        }
    }

    getSelectedLearnerNames() {
        return this.learners
            .filter(l => this.selectedLearners.includes(l.id))
            .map(l => l.name);
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
                { title: 'Name', data: 'name', className: 'learner-name-cell' },
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
                emptyTable: this.loggedInUser
                    ? "No learners added yet. Add some learners to get started!"
                    : "Please login to manage your Learning Team.",
                zeroRecords: "No learners found matching your search.",
                search: "Search learners:",
                lengthMenu: "Show _MENU_ learners per page",
                info: "Showing _START_ to _END_ of _TOTAL_ learners",
                infoEmpty: "No learners to show",
                infoFiltered: "(filtered from _MAX_ total learners)"
            },
            drawCallback: () => {
                this.initializeTableEvents();
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });

        this.refreshTable();
    }

    initializeTableEvents() {
        $('#learners-table').off('change', '.learner-checkbox');
        $('#learners-table').off('click', '.delete-icon');

        $('#learners-table').on('change', '.learner-checkbox', (e) => {
            const id = e.target.getAttribute('data-id');
            if (id) this.handleSelectLearner(parseInt(id, 10), e.target.checked);
        });

        $('#learners-table').on('click', '.delete-icon', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target;
            const rawId = target.getAttribute('data-id') ||
                          target.closest('[data-id]')?.getAttribute('data-id');
            if (rawId) this.deleteLearner(parseInt(rawId, 10));
        });

        $('#select-all').off('change').on('change', (e) => this.handleSelectAll(e.target.checked));
        this.updateSelectAllCheckbox();
    }

    refreshTable() {
        if (this.dataTable) this.dataTable.clear().rows.add(this.learners).draw();
    }

    updateCounts() {
        const totalEl = document.getElementById('total-learners');
        const selectedEl = document.getElementById('selected-learners');
        if (totalEl) totalEl.textContent = this.learners.length;
        if (selectedEl) selectedEl.textContent = this.selectedLearners.length;
    }

    // ─── Server data loading ────────────────────────────

    async loadLearnersFromServer() {
        if (!this.loggedInUser) return;

        try {
            const url = `./auth-backend/get-learners.php?email=${encodeURIComponent(this.loggedInUser.email)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (res.ok && data.success) {
                this.learners = data.learners; // [{ id, name }, ...]
            } else {
                console.warn('Failed to load learners:', data.message);
                this.learners = [];
            }
        } catch (err) {
            console.error('Error loading learners from server:', err);
            this.learners = [];
        }

        // Restore selected IDs from localStorage (scoped by user email)
        const storageKey = `selectedLearners_${this.loggedInUser.email}`;
        const savedSelected = Utils.getFromStorage(storageKey, []);
        this.selectedLearners = savedSelected.filter(id =>
            this.learners.some(l => l.id === id)
        );

        // If nothing selected but learners exist, select all
        if (this.selectedLearners.length === 0 && this.learners.length > 0) {
            this.selectedLearners = this.learners.map(l => l.id);
        }

        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
    }

    // ─── Persistence (selection only — learners live in DB) ─

    saveSelectedLearners() {
        if (!this.loggedInUser) return;
        const storageKey = `selectedLearners_${this.loggedInUser.email}`;
        Utils.saveToStorage(storageKey, this.selectedLearners);
    }

    // ─── Public API ─────────────────────────────────────

    getLearners() { return this.learners; }
    getSelectedLearners() { return this.selectedLearners; }

    setSelectedLearners(ids) {
        this.selectedLearners = ids.filter(id => this.learners.some(l => l.id === id));
        this.saveSelectedLearners();
        this.refreshTable();
        this.updateCounts();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearnHome;
} 