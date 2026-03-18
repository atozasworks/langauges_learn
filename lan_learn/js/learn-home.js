// Learn Home Page JavaScript — User-specific Learning Team (API-backed)
class LearnHome {
    constructor() {
        this.learners = [];
        this.selectedLearners = [];
        this.dataTable = null;
        this.loggedInUser = null; // { name, email }
        this.allLocations = []; // All stored location combos from server
        this.currentLocation = { country: '', region: '', district: '', place: '' };
        this.locationDebounceTimer = null;
        this.init();
    }

    async init() {
        this.resolveLoggedInUser();
        this.restoreCurrentLocation();
        this.setupEventListeners();
        this.setupLocationListeners();
        this.initializeDataTable();

        if (this.loggedInUser) {
            await this.loadLocationsFromServer();
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
        this.restoreCurrentLocation();
        await this.loadLocationsFromServer();
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

    // ─── Location helpers ───────────────────────────────

    restoreCurrentLocation() {
        if (!this.loggedInUser) return;
        const storageKey = `currentLocation_${this.loggedInUser.email}`;
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const loc = JSON.parse(saved);
                if (loc && typeof loc === 'object') {
                    this.currentLocation = {
                        country: loc.country || '',
                        region: loc.region || '',
                        district: loc.district || '',
                        place: loc.place || '',
                    };
                }
            }
        } catch (_) {}
        // Populate the input fields
        this.populateLocationInputs();
    }

    saveCurrentLocation() {
        if (!this.loggedInUser) return;
        const storageKey = `currentLocation_${this.loggedInUser.email}`;
        localStorage.setItem(storageKey, JSON.stringify(this.currentLocation));
    }

    populateLocationInputs() {
        const fields = ['country', 'region', 'district', 'place'];
        fields.forEach(f => {
            const el = document.getElementById(`location-${f}`);
            if (el) el.value = this.currentLocation[f] || '';
        });
    }

    readLocationFromInputs() {
        return {
            country:  (document.getElementById('location-country')?.value || '').trim(),
            region:   (document.getElementById('location-region')?.value || '').trim(),
            district: (document.getElementById('location-district')?.value || '').trim(),
            place:    (document.getElementById('location-place')?.value || '').trim(),
        };
    }

    setupLocationListeners() {
        const fields = ['country', 'region', 'district', 'place'];
        fields.forEach(f => {
            const el = document.getElementById(`location-${f}`);
            if (el) {
                el.addEventListener('input', () => this.onLocationFieldChange(f));
                el.addEventListener('change', () => this.onLocationFieldChange(f));
            }
        });
    }

    onLocationFieldChange(changedField) {
        const newLoc = this.readLocationFromInputs();

        // Clear child fields when a parent field changes
        const hierarchy = ['country', 'region', 'district', 'place'];
        const changedIdx = hierarchy.indexOf(changedField);
        if (changedIdx >= 0) {
            for (let i = changedIdx + 1; i < hierarchy.length; i++) {
                const childEl = document.getElementById(`location-${hierarchy[i]}`);
                if (childEl && this.currentLocation[hierarchy[i]] !== '' &&
                    newLoc[changedField] !== this.currentLocation[changedField]) {
                    // Parent changed — clear children
                    childEl.value = '';
                    newLoc[hierarchy[i]] = '';
                }
            }
        }

        this.currentLocation = newLoc;
        this.saveCurrentLocation();
        this.updateLocationDataLists();

        // Debounce reload learners
        clearTimeout(this.locationDebounceTimer);
        this.locationDebounceTimer = setTimeout(() => {
            if (this.loggedInUser) {
                this.loadLearnersFromServer();
            }
        }, 500);
    }

    async loadLocationsFromServer() {
        try {
            const res = await fetch('./auth-backend/get-locations.php');
            const data = await res.json();
            if (res.ok && data.success) {
                this.allLocations = data.locations || [];
            } else {
                this.allLocations = [];
            }
        } catch (err) {
            console.warn('Error loading locations:', err);
            this.allLocations = [];
        }
        this.updateLocationDataLists();
    }

    updateLocationDataLists() {
        const loc = this.currentLocation;

        // Countries: all unique
        const countries = [...new Set(this.allLocations.map(l => l.country).filter(Boolean))];
        this.fillDataList('country-list', countries);

        // Regions: filter by current country
        const filteredByCountry = this.allLocations.filter(l =>
            !loc.country || l.country === loc.country
        );
        const regions = [...new Set(filteredByCountry.map(l => l.region).filter(Boolean))];
        this.fillDataList('region-list', regions);

        // Districts: filter by country + region
        const filteredByRegion = filteredByCountry.filter(l =>
            !loc.region || l.region === loc.region
        );
        const districts = [...new Set(filteredByRegion.map(l => l.district).filter(Boolean))];
        this.fillDataList('district-list', districts);

        // Places: filter by country + region + district
        const filteredByDistrict = filteredByRegion.filter(l =>
            !loc.district || l.district === loc.district
        );
        const places = [...new Set(filteredByDistrict.map(l => l.place).filter(Boolean))];
        this.fillDataList('place-list', places);
    }

    fillDataList(datalistId, values) {
        const dl = document.getElementById(datalistId);
        if (!dl) return;
        dl.innerHTML = '';
        values.sort().forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            dl.appendChild(opt);
        });
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

        this.setupVariantDropdown();

        this.setupPopupListeners();
    }

    setupVariantDropdown() {
        const dropdown = document.getElementById('variant-dropdown');
        const toggleBtn = document.getElementById('variant-dropdown-toggle');
        const menu = document.getElementById('variant-dropdown-menu');
        const searchInput = document.getElementById('variant-search-input');
        const options = Array.from(document.querySelectorAll('.variant-option'));
        const noResults = document.getElementById('variant-no-results');
        const hoverMessage = document.getElementById('variant-hover-message');

        if (!dropdown || !toggleBtn || !menu || !searchInput || options.length === 0 || !noResults || !hoverMessage) {
            return;
        }

        const defaultHoverMessage = hoverMessage.textContent.trim();

        const setHoverMessage = (option) => {
            const message = option?.getAttribute('data-hover-message') || defaultHoverMessage;
            hoverMessage.textContent = message;
        };

        const resetHoverMessage = () => {
            hoverMessage.textContent = defaultHoverMessage;
        };

        const openMenu = () => {
            dropdown.classList.add('is-open');
            toggleBtn.setAttribute('aria-expanded', 'true');
            menu.hidden = false;
            searchInput.value = '';
            this.filterVariantOptions('', options, noResults);
            resetHoverMessage();
            searchInput.focus();
        };

        const closeMenu = () => {
            dropdown.classList.remove('is-open');
            toggleBtn.setAttribute('aria-expanded', 'false');
            menu.hidden = true;
            searchInput.value = '';
            this.filterVariantOptions('', options, noResults);
            resetHoverMessage();
        };

        toggleBtn.addEventListener('click', () => {
            if (menu.hidden) {
                openMenu();
            } else {
                closeMenu();
            }
        });

        searchInput.addEventListener('input', () => {
            this.filterVariantOptions(searchInput.value, options, noResults);
            resetHoverMessage();
        });

        searchInput.addEventListener('focus', () => {
            resetHoverMessage();
        });

        options.forEach((option) => {
            option.addEventListener('mouseenter', () => setHoverMessage(option));
            option.addEventListener('focus', () => setHoverMessage(option));
            option.addEventListener('mouseleave', () => resetHoverMessage());
            option.addEventListener('blur', () => resetHoverMessage());

            option.addEventListener('click', () => {
                options.forEach((btn) => btn.classList.remove('is-selected'));
                option.classList.add('is-selected');
                const targetPath = option.getAttribute('data-value');
                if (targetPath) window.location.href = targetPath;
            });
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) closeMenu();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu();
        });
    }

    filterVariantOptions(query, options, noResults) {
        const normalizedQuery = query.trim().toLowerCase();
        let visibleCount = 0;

        options.forEach((option) => {
            const label = (option.textContent || '').toLowerCase();
            const isMatch = normalizedQuery === '' || label.includes(normalizedQuery);
            option.classList.toggle('is-hidden', !isMatch);
            if (isMatch) visibleCount += 1;
        });

        noResults.hidden = visibleCount !== 0;
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
                body: JSON.stringify({
                    email: this.loggedInUser.email,
                    name: formattedName,
                    country: this.currentLocation.country,
                    region: this.currentLocation.region,
                    district: this.currentLocation.district,
                    place: this.currentLocation.place,
                })
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

            // Refresh locations (new location may have been added)
            this.loadLocationsFromServer();
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
                body: JSON.stringify({
                    email: this.loggedInUser.email,
                    learner_id: id,
                    country: this.currentLocation.country,
                    region: this.currentLocation.region,
                    district: this.currentLocation.district,
                    place: this.currentLocation.place,
                })
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
            const params = new URLSearchParams({
                email: this.loggedInUser.email,
                country: this.currentLocation.country,
                region: this.currentLocation.region,
                district: this.currentLocation.district,
                place: this.currentLocation.place,
            });
            const url = `./auth-backend/get-learners.php?${params.toString()}`;
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