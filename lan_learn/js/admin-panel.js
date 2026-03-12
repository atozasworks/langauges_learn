class AdminPanel {
  constructor() {
    this.loggedInUser = null;
    this.learners = [];
    this.editingLearnerId = null;

    this.createForm = document.getElementById('create-form');
    this.filterForm = document.getElementById('filter-form');
    this.filterSearch = document.getElementById('filter-search');
    this.resetFilterBtn = document.getElementById('reset-filter-btn');
    this.refreshBtn = document.getElementById('refresh-btn');
    this.statusText = document.getElementById('status-text');
    this.tableBody = document.getElementById('learners-tbody');

    this.bindEvents();
    this.enforceLogin();
  }

  bindEvents() {
    this.refreshBtn?.addEventListener('click', () => {
      this.loadLearners();
    });

    this.createForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.createLearner();
    });

    this.filterForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.renderTable();
    });

    this.resetFilterBtn?.addEventListener('click', () => {
      if (this.filterSearch) {
        this.filterSearch.value = '';
      }
      this.renderTable();
    });

    this.tableBody?.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }

      const action = button.dataset.action;
      const learnerId = Number(button.dataset.id || 0);
      if (!learnerId) {
        return;
      }

      if (action === 'edit') {
        this.editingLearnerId = learnerId;
        this.renderTable();
        return;
      }

      if (action === 'cancel') {
        this.editingLearnerId = null;
        this.renderTable();
        return;
      }

      if (action === 'save') {
        this.saveEditedLearner(learnerId);
        return;
      }

      if (action === 'delete') {
        this.deleteLearner(learnerId);
      }
    });
  }

  enforceLogin() {
    const raw = sessionStorage.getItem('loggedInUser');
    if (!raw) {
      window.location.href = 'login-modal.html?redirect=admin-panel.html';
      return;
    }

    try {
      this.loggedInUser = JSON.parse(raw);
    } catch (_) {
      this.loggedInUser = null;
    }

    if (!this.loggedInUser || !this.loggedInUser.email) {
      sessionStorage.removeItem('loggedInUser');
      window.location.href = 'login-modal.html?redirect=admin-panel.html';
      return;
    }

    const emailInput = document.getElementById('create-email');
    if (emailInput) {
      emailInput.value = this.loggedInUser.email;
    }

    this.setStatus('Loading your learner records...', 'warn');
    this.loadLearners();
  }

  setStatus(message, tone = '') {
    if (!this.statusText) {
      return;
    }

    this.statusText.textContent = message;
    this.statusText.className = 'status-text';
    if (tone) {
      this.statusText.classList.add(tone);
    }
  }

  getFilteredLearners() {
    const q = (this.filterSearch?.value || '').trim().toLowerCase();
    if (!q) {
      return this.learners;
    }

    return this.learners.filter((item) => {
      const name = String(item.name || '').toLowerCase();
      const id = String(item.id || '');
      const email = String(this.loggedInUser?.email || '').toLowerCase();
      return name.includes(q) || id.includes(q) || email.includes(q);
    });
  }

  async loadLearners() {
    if (!this.loggedInUser?.email) {
      return;
    }

    this.setStatus('Loading learners...', 'warn');

    try {
      const params = new URLSearchParams({ email: this.loggedInUser.email });
      const data = await this.requestJson(`get-learners.php?${params.toString()}`, { method: 'GET' });
      this.learners = data.learners || [];
      this.editingLearnerId = null;
      this.renderTable();
      this.setStatus(`Loaded ${this.learners.length} learner records.`, 'ok');
    } catch (error) {
      this.setStatus(error.message || 'Failed to load learners.', 'error');
    }
  }

  async createLearner() {
    if (!this.loggedInUser?.email) {
      return;
    }

    const emailInput = document.getElementById('create-email');
    const nameInput = document.getElementById('create-name');

    const email = emailInput.value.trim() || this.loggedInUser.email;
    const name = nameInput.value.trim();

    if (!name) {
      this.setStatus('Learner name is required.', 'error');
      return;
    }

    if (email.toLowerCase() !== this.loggedInUser.email.toLowerCase()) {
      this.setStatus('You can only create learners for your logged-in email.', 'error');
      return;
    }

    this.setStatus('Creating learner...', 'warn');

    try {
      await this.requestJson('add-learner.php', {
        method: 'POST',
        body: { email: this.loggedInUser.email, name },
      });

      emailInput.value = this.loggedInUser.email;
      nameInput.value = '';
      this.setStatus('Learner created successfully.', 'ok');
      await this.loadLearners();
    } catch (error) {
      this.setStatus(error.message || 'Failed to create learner.', 'error');
    }
  }

  async saveEditedLearner(learnerId) {
    if (!this.loggedInUser?.email) {
      return;
    }

    const row = this.tableBody.querySelector(`tr[data-id="${learnerId}"]`);
    if (!row) {
      return;
    }

    const nameInput = row.querySelector('.edit-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      this.setStatus('Learner name is required for update.', 'error');
      return;
    }

    this.setStatus(`Saving learner #${learnerId}...`, 'warn');

    try {
      await this.requestJson('update-learner.php', {
        method: 'POST',
        body: {
          email: this.loggedInUser.email,
          learner_id: learnerId,
          name,
        },
      });

      this.editingLearnerId = null;
      this.setStatus(`Learner #${learnerId} updated.`, 'ok');
      await this.loadLearners();
    } catch (error) {
      this.setStatus(error.message || 'Failed to update learner.', 'error');
    }
  }

  async deleteLearner(learnerId) {
    if (!this.loggedInUser?.email) {
      return;
    }

    const confirmed = window.confirm(`Delete learner #${learnerId}?`);
    if (!confirmed) {
      return;
    }

    this.setStatus(`Deleting learner #${learnerId}...`, 'warn');

    try {
      await this.requestJson('delete-learner.php', {
        method: 'POST',
        body: {
          email: this.loggedInUser.email,
          learner_id: learnerId,
        },
      });

      this.setStatus(`Learner #${learnerId} deleted.`, 'ok');
      await this.loadLearners();
    } catch (error) {
      this.setStatus(error.message || 'Failed to delete learner.', 'error');
    }
  }

  renderTable() {
    if (!this.tableBody) {
      return;
    }

    const list = this.getFilteredLearners();

    if (!list.length) {
      this.tableBody.innerHTML = '<tr><td colspan="6" class="empty">No records found.</td></tr>';
      return;
    }

    const rows = list.map((learner) => {
      const isEditing = this.editingLearnerId === learner.id;

      const emailCell = this.escapeHtml(this.loggedInUser?.email || '');
      const nameCell = isEditing
        ? `<input class="edit-name" type="text" value="${this.escapeHtml(learner.name || '')}" />`
        : this.escapeHtml(learner.name || '');

      const actions = isEditing
        ? `
          <div class="row-actions">
            <button type="button" class="mini-btn" data-action="save" data-id="${learner.id}">Save</button>
            <button type="button" class="mini-btn" data-action="cancel" data-id="${learner.id}">Cancel</button>
          </div>
        `
        : `
          <div class="row-actions">
            <button type="button" class="mini-btn" data-action="edit" data-id="${learner.id}">Edit</button>
            <button type="button" class="mini-btn delete" data-action="delete" data-id="${learner.id}">Delete</button>
          </div>
        `;

      return `
        <tr data-id="${learner.id}">
          <td>${learner.id}</td>
          <td>${emailCell}</td>
          <td>${nameCell}</td>
          <td>-</td>
          <td>-</td>
          <td>${actions}</td>
        </tr>
      `;
    });

    this.tableBody.innerHTML = rows.join('');
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async requestJson(path, options) {
    const requestOptions = {
      method: options.method || 'GET',
      headers: {},
    };

    if (options.body) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(`./auth-backend/${path}`, requestOptions);

    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Request failed with status ${response.status}.`);
    }

    return data;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AdminPanel();
});
