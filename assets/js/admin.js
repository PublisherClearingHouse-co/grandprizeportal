// =============================================
// ADMIN.JS – Admin Portal Application
// =============================================

(function() {
    // ---- Check authentication ----
    if (!AuthService.requireAdmin()) return;

    const main = document.getElementById('main-content');
    if (!main) return;

    // ---- Render based on hash ----
    function render() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        switch(hash) {
            case 'dashboard': renderDashboard(); break;
            case 'winners': renderWinners(); break;
            case 'schedules': renderSchedules(); break;
            case 'add-funds': renderAddFunds(); break;
            case 'kyc-review': renderKycReview(); break;
            case 'withdrawals-review': renderWithdrawalsReview(); break;
            case 'announcements': renderAnnouncements(); break;
            case 'import': renderImport(); break;
            case 'audit': renderAudit(); break;
            case 'support': renderAdminSupport(); break;
            case 'settings': renderSettings(); break;
            default: renderDashboard();
        }
    }

    // ---- Dashboard ----
    function renderDashboard() {
        const users = UserService.getUsers();
        const total = users.filter(u => u.role === 'user').length;
        const active = users.filter(u => u.role === 'user' && u.status === 'active').length;
        const vip = users.filter(u => u.role === 'user' && u.vip_level !== 'Standard').length;
        const totalFunds = users.reduce((sum, u) => sum + u.balance + u.prize_amount, 0);
        const schedules = ScheduleService.getAll().filter(s => s.status === 'active');
        const pendingKyc = KycService.getPending().length;
        const pendingWithdrawals = WithdrawalService.getPending().length;

        main.innerHTML = `
            <div class="grid-4 mb-24">
                <div class="stat-card"><div class="number">${total}</div><div class="label">Total Winners</div></div>
                <div class="stat-card"><div class="number">${active}</div><div class="label">Active</div></div>
                <div class="stat-card"><div class="number">${vip}</div><div class="label">VIP</div></div>
                <div class="stat-card"><div class="number">$${totalFunds.toFixed(0)}</div><div class="label">Total Funds</div></div>
            </div>
            <div class="grid-3 mb-24">
                <div class="stat-card"><div class="number">${pendingKyc}</div><div class="label">Pending KYC</div></div>
                <div class="stat-card"><div class="number">${pendingWithdrawals}</div><div class="label">Pending Withdrawals</div></div>
                <div class="stat-card"><div class="number">${schedules.length}</div><div class="label">Active Schedules</div></div>
            </div>
            <div class="card card-glow mb-24">
                <h3 style="color:#ffd700;">📅 Active Funding Schedules</h3>
                ${schedules.length > 0 ? schedules.map(s => `
                    <div class="flex-between" style="padding:6px 0;border-bottom:1px solid #1a1a3e;">
                        <span>${s.name} – $${s.amount} (${s.frequency})</span>
                        <span class="badge badge-success">ACTIVE</span>
                    </div>
                `).join('') : '<p>No active schedules.</p>'}
                <a href="#schedules" class="btn btn-secondary btn-sm mt-8">Manage Schedules</a>
            </div>
            <div class="grid-2 mb-24">
                <div class="card">
                    <h4 style="color:#ffd700;">👥 User Distribution by VIP</h4>
                    <canvas id="vipChart" height="150"></canvas>
                </div>
                <div class="card">
                    <h4 style="color:#ffd700;">📊 Transaction Volume (last 30 days)</h4>
                    <canvas id="txChart" height="150"></canvas>
                </div>
            </div>
            <div class="card">
                <h4 style="color:#ffd700;">Recent Audit Events</h4>
                ${DataService.getAuditLogs().slice(0,5).map(log => `
                    <div class="flex-between" style="padding:6px 0;border-bottom:1px solid #1a1a3e;">
                        <span>${log.event}</span>
                        <span class="text-muted">${log.actor}</span>
                        <span class="text-muted">${new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                `).join('') || '<p class="text-muted">No audits.</p>'}
            </div>
        `;
        // Charts
        setTimeout(() => {
            const vipCtx = document.getElementById('vipChart');
            if (vipCtx && typeof Chart !== 'undefined') {
                const vipCounts = {};
                users.filter(u => u.role === 'user').forEach(u => { vipCounts[u.vip_level] = (vipCounts[u.vip_level] || 0) + 1; });
                new Chart(vipCtx, {
                    type: 'pie',
                    data: { labels: Object.keys(vipCounts), datasets: [{ data: Object.values(vipCounts), backgroundColor: ['#ffd700','#8e44ad','#3498db','#2ecc71','#e74c3c'] }] },
                    options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } } }
                });
            }
            const txCtx = document.getElementById('txChart');
            if (txCtx && typeof Chart !== 'undefined') {
                const now = new Date();
                const last30 = [];
                for (let i = 29; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().slice(0,10);
                    const total = DataService.getFundingRecords().filter(f => f.createdAt.startsWith(dateStr)).reduce((s, f) => s + f.amount, 0);
                    last30.push(total);
                }
                new Chart(txCtx, {
                    type: 'bar',
                    data: { labels: Array.from({length:30}, (_,i) => i+1), datasets: [{ label: 'Daily Volume ($)', data: last30, backgroundColor: '#ffd700' }] },
                    options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
                });
            }
        }, 200);
    }

    // ---- Winners Management ----
    function renderWinners() {
        const users = UserService.getWinners();
        main.innerHTML = `
            <h2>👤 Winners</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
                <input type="text" id="winnerSearch" placeholder="Search name, email, ID" oninput="filterWinners()" style="flex:1;min-width:200px;padding:8px;border-radius:8px;border:2px solid #2a2a5a;background:#0f0f22;color:#fff;" />
                <select id="vipFilter" onchange="filterWinners()" style="padding:8px;border-radius:8px;border:2px solid #2a2a5a;background:#0f0f22;color:#fff;">
                    <option value="">All VIP</option>
                    <option value="Standard">Standard</option>
                    <option value="VIP">VIP</option>
                    <option value="VIP Gold">VIP Gold</option>
                    <option value="VIP Platinum">VIP Platinum</option>
                    <option value="VIP Elite">VIP Elite</option>
                </select>
                <select id="statusFilter" onchange="filterWinners()" style="padding:8px;border-radius:8px;border:2px solid #2a2a5a;background:#0f0f22;color:#fff;">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                </select>
            </div>
            <div class="card">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Balance</th><th>VIP</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody id="winnerTableBody">
                            ${users.map(u => `
                                <tr>
                                    <td>${u.id}</td>
                                    <td>${u.firstName} ${u.lastName}</td>
                                    <td>${u.email}</td>
                                    <td>$${(u.balance + u.prize_amount).toFixed(2)}</td>
                                    <td><select onchange="changeVIP(${u.id}, this.value)" class="form-control" style="background:#0f0f22;color:#fff;border:1px solid #2a2a5a;padding:4px 8px;border-radius:4px;">
                                        ${APP_CONFIG.VIP_LEVELS.map(l => `<option value="${l}" ${u.vip_level===l?'selected':''}>${l}</option>`).join('')}
                                    </select></td>
                                    <td><span class="badge badge-${u.status==='active'?'success':'danger'}">${u.status}</span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm" onclick="viewWinner(${u.id})">View</button>
                                        <button class="btn btn-danger btn-sm" onclick="suspendUser(${u.id})">Suspend</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        // Setup filter function
        window.filterWinners = function() {
            const search = document.getElementById('winnerSearch').value.toLowerCase();
            const vip = document.getElementById('vipFilter').value;
            const status = document.getElementById('statusFilter').value;
            const rows = document.querySelectorAll('#winnerTableBody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const rowVip = row.querySelector('select')?.value || '';
                const rowStatus = row.querySelector('.badge')?.textContent?.toLowerCase() || '';
                let show = true;
                if (search && !text.includes(search)) show = false;
                if (vip && rowVip !== vip) show = false;
                if (status && rowStatus !== status) show = false;
                row.style.display = show ? '' : 'none';
            });
        };
    }

    // ---- VIP Change ----
    window.changeVIP = function(userId, newLevel) {
        try {
            UserService.updateUser(userId, { vip_level: newLevel });
            UI.showToast(`VIP level updated to ${newLevel}`, 'success');
            renderWinners();
        } catch (e) {
            UI.showToast(e.message, 'error');
        }
    };

    // ---- Suspend User ----
    window.suspendUser = async function(id) {
        const confirm = await UI.confirm('Suspend this user?', 'Confirm Suspension');
        if (!confirm) return;
        try {
            UserService.updateUser(id, { status: 'suspended' });
            UI.showToast('User suspended.', 'success');
            renderWinners();
        } catch (e) {
            UI.showToast(e.message, 'error');
        }
    };

    // ---- View Winner ----
    window.viewWinner = function(userId) {
        const u = UserService.getUser(userId);
        if (!u) return UI.showToast('User not found', 'error');
        const funds = TransactionService.getTransactions(userId);
        const modal = UI.showModal({
            title: `👤 ${u.firstName} ${u.lastName}`,
            body: `
                <p>Email: ${u.email} • VIP: ${u.vip_level} • Status: ${u.status}</p>
                <p>Balance: $${(u.balance+u.prize_amount).toFixed(2)}</p>
                <h4 style="color:#ffd700;margin-top:12px;">Funding History</h4>
                <div style="max-height:300px;overflow-y:auto;">
                    ${funds.map(f => `
                        <div class="flex-between" style="padding:6px 0;border-bottom:1px solid #1a1a3e;cursor:pointer;" onclick="UI.closeModal(); showTransactionDetail(${f.id})">
                            <span>${f.description}</span>
                            <span>$${f.amount.toFixed(2)}</span>
                            <span class="text-muted">${new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                    `).join('') || '<p class="text-muted">No funding.</p>'}
                </div>
            `,
            buttons: [{ label: 'Close', class: 'btn-secondary', action: 'close' }],
            callbacks: { close: () => UI.closeModal() }
        });
        AuthService._audit('ADMIN_VIEWED_WINNER', `Admin viewed winner ${u.email}`, userId);
    };

    // ---- Transaction Detail (Admin) ----
    window.showTransactionDetail = function(id) {
        const fund = TransactionService.getTransaction(id);
        if (!fund) return UI.showToast('Transaction not found', 'error');
        const user = UserService.getUser(fund.userId);
        UI.showModal({
            title: '📄 Transaction Details',
            body: `
                <div class="detail-row"><span class="label">ID</span><span class="value">${fund.id}</span></div>
                <div class="detail-row"><span class="label">User</span><span class="value">${user ? user.email : 'Unknown'}</span></div>
                <div class="detail-row"><span class="label">Date</span><span class="value">${new Date(fund.createdAt).toLocaleString()}</span></div>
                <div class="detail-row"><span class="label">Amount</span><span class="value">$${fund.amount.toFixed(2)}</span></div>
                <div class="detail-row"><span class="label">Type</span><span class="value">${fund.type}</span></div>
                <div class="detail-row"><span class="label">Description</span><span class="value">${fund.description}</span></div>
                <div class="detail-row"><span class="label">Status</span><span class="value"><span class="badge badge-${fund.status==='completed'?'success':'warning'}">${fund.status}</span></span></div>
            `,
            buttons: [{ label: 'Close', class: 'btn-secondary', action: 'close' }],
            callbacks: { close: () => UI.closeModal() }
        });
        AuthService._audit('ADMIN_VIEWED_TRANSACTION', `Admin viewed transaction ${id}`, null);
    };

    // ---- Schedules ----
    function renderSchedules() {
        const schedules = ScheduleService.getAll();
        main.innerHTML = `
            <h2>📅 Funding Schedules</h2>
            <div class="card">
                <h4 style="color:#ffd700;">Create Schedule</h4>
                <form id="scheduleForm">
                    <div class="form-group"><label>Name</label><input type="text" id="scheduleName" value="Weekly Friday Funding" required /></div>
                    <div class="form-group"><label>Amount ($)</label><input type="number" id="scheduleAmount" value="7000" step="1" required /></div>
                    <div class="form-group"><label>Frequency</label>
                        <select id="scheduleFrequency">
                            <option value="weekly">Weekly (Friday)</option>
                            <option value="monthly">Monthly (1st)</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-gold">Create Schedule</button>
                </form>
            </div>
            <div class="card mt-16">
                <h4 style="color:#ffd700;">Existing Schedules</h4>
                ${schedules.map(s => `
                    <div class="flex-between" style="padding:8px 0;border-bottom:1px solid #1a1a3e;">
                        <span>${s.name} – $${s.amount} (${s.frequency})</span>
                        <span class="badge badge-${s.status==='active'?'success':'danger'}">${s.status}</span>
                        <button class="btn btn-secondary btn-sm" onclick="toggleSchedule(${s.id})">${s.status==='active'?'Pause':'Resume'}</button>
                    </div>
                `).join('') || '<p class="text-muted">No schedules.</p>'}
            </div>
        `;
        document.getElementById('scheduleForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('scheduleName').value;
            const amount = parseFloat(document.getElementById('scheduleAmount').value);
            const frequency = document.getElementById('scheduleFrequency').value;
            try {
                ScheduleService.create(name, amount, frequency);
                UI.showToast('Schedule created!', 'success');
                renderSchedules();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    window.toggleSchedule = function(id) {
        try {
            ScheduleService.toggle(id);
            UI.showToast('Schedule toggled.', 'success');
            renderSchedules();
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    };

    // ---- Add Funds ----
    function renderAddFunds() {
        const users = UserService.getWinners();
        main.innerHTML = `
            <h2>💰 Add Funds</h2>
            <div class="card">
                <form id="addFundsForm">
                    <div class="form-group"><label>Select Winner</label>
                        <select id="fundUser">
                            ${users.map(u => `<option value="${u.id}">${u.firstName} ${u.lastName} (${u.email})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"><label>Amount ($)</label><input type="number" id="fundAmount" step="0.01" required /></div>
                    <div class="form-group"><label>Description</label><input type="text" id="fundDesc" placeholder="Reason" /></div>
                    <button type="submit" class="btn btn-gold">Add Funds</button>
                </form>
            </div>
        `;
        document.getElementById('addFundsForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const userId = parseInt(document.getElementById('fundUser').value);
            const amount = parseFloat(document.getElementById('fundAmount').value);
            const desc = document.getElementById('fundDesc').value || 'Manual addition';
            if (!amount || amount <= 0) return UI.showToast('Enter a valid amount.', 'error');
            try {
                FundsService.addFunds(userId, amount, 'manual', desc);
                UI.showToast('Funds added!', 'success');
                renderAddFunds();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    // ---- KYC Review ----
    function renderKycReview() {
        const kycs = KycService.getPending();
        main.innerHTML = `
            <h2>🪪 KYC Review</h2>
            ${kycs.map(k => {
                const u = UserService.getUser(k.userId);
                return `
                    <div class="card mb-16">
                        <div class="flex-between">
                            <div><strong>${u ? u.firstName + ' ' + u.lastName : 'Unknown'}</strong> (${u ? u.email : ''})</div>
                            <div><span class="badge badge-warning">Pending</span></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;">
                            ${k.frontImage ? `<img src="${k.frontImage}" style="max-width:100%;max-height:120px;border-radius:8px;" />` : '<div style="color:#666;padding:10px;">No front image</div>'}
                            ${k.backImage ? `<img src="${k.backImage}" style="max-width:100%;max-height:120px;border-radius:8px;" />` : '<div style="color:#666;padding:10px;">No back image</div>'}
                            ${k.selfieImage ? `<img src="${k.selfieImage}" style="max-width:100%;max-height:120px;border-radius:8px;" />` : '<div style="color:#666;padding:10px;">No selfie</div>'}
                        </div>
                        <div>
                            <button class="btn btn-success btn-sm" onclick="approveKyc(${k.id})">✅ Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectKyc(${k.id})">❌ Reject</button>
                        </div>
                    </div>
                `;
            }).join('') || '<p class="text-muted">No pending KYC submissions.</p>'}
        `;
    }

    window.approveKyc = function(id) {
        try {
            KycService.approve(id);
            UI.showToast('KYC approved.', 'success');
            renderKycReview();
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    };

    window.rejectKyc = function(id) {
        if (!confirm('Reject this KYC?')) return;
        try {
            KycService.reject(id);
            UI.showToast('KYC rejected.', 'success');
            renderKycReview();
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    };

    // ---- Withdrawals Review ----
    function renderWithdrawalsReview() {
        const withdrawals = WithdrawalService.getPending();
        main.innerHTML = `
            <h2>💳 Withdrawals Review</h2>
            ${withdrawals.map(w => {
                const u = UserService.getUser(w.userId);
                return `
                    <div class="card mb-16">
                        <div class="flex-between">
                            <div><strong>${u ? u.firstName + ' ' + u.lastName : 'Unknown'}</strong> (${u ? u.email : ''})</div>
                            <div><span class="badge badge-warning">Pending</span></div>
                        </div>
                        <div class="detail-row"><span class="label">Method</span><span class="value">${w.method} (${w.accountRef})</span></div>
                        <div class="detail-row"><span class="label">Amount</span><span class="value">$${w.amount.toFixed(2)}</span></div>
                        <div class="detail-row"><span class="label">Description</span><span class="value">${w.description || ''}</span></div>
                        <div>
                            <button class="btn btn-success btn-sm" onclick="approveWithdrawal(${w.id})">✅ Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectWithdrawal(${w.id})">❌ Reject</button>
                        </div>
                    </div>
                `;
            }).join('') || '<p class="text-muted">No pending withdrawals.</p>'}
        `;
    }

    window.approveWithdrawal = async function(id) {
        const confirm = await UI.confirm('Approve this withdrawal?', 'Confirm Approval');
        if (!confirm) return;
        try {
            WithdrawalService.approve(id);
            UI.showToast('Withdrawal approved and processed.', 'success');
            renderWithdrawalsReview();
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    };

    window.rejectWithdrawal = function(id) {
        if (!confirm('Reject this withdrawal?')) return;
        try {
            WithdrawalService.reject(id);
            UI.showToast('Withdrawal rejected.', 'success');
            renderWithdrawalsReview();
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    };

    // ---- Announcements ----
    function renderAnnouncements() {
        const announcements = AnnouncementService.getAll();
        main.innerHTML = `
            <h2>📢 Announcements</h2>
            <div class="card">
                <h4 style="color:#ffd700;">Create Announcement</h4>
                <form id="announcementForm">
                    <div class="form-group"><label>Title</label><input type="text" id="annTitle" required /></div>
                    <div class="form-group"><label>Message</label><textarea id="annMessage" required></textarea></div>
                    <button type="submit" class="btn btn-gold">Post Announcement</button>
                </form>
            </div>
            <div class="card mt-16">
                <h4 style="color:#ffd700;">All Announcements</h4>
                ${announcements.map(a => `
                    <div class="flex-between" style="padding:8px 0;border-bottom:1px solid #1a1a3e;">
                        <div><strong>${a.title}</strong><br/><span class="text-muted">${a.message}</span></div>
                        <span class="text-muted">${new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                `).join('') || '<p class="text-muted">No announcements.</p>'}
            </div>
        `;
        document.getElementById('announcementForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const title = document.getElementById('annTitle').value;
            const message = document.getElementById('annMessage').value;
            try {
                AnnouncementService.create(title, message);
                UI.showToast('Announcement posted.', 'success');
                renderAnnouncements();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    // ---- Import ----
    function renderImport() {
        main.innerHTML = `
            <h2>📂 Bulk Import Users</h2>
            <div class="card">
                <p class="text-muted">Upload a CSV, TXT, XML, or PDF file with user data. Required columns: first_name, last_name, email, password. Optional: balance, vip_level, status, phone, address.</p>
                <form id="importForm">
                    <div class="form-group"><label>File (CSV/TXT/XML/PDF)</label><input type="file" id="importFile" accept=".csv,.txt,.xml,.pdf" required /></div>
                    <button type="submit" class="btn btn-gold">Import Users</button>
                </form>
                <div id="importResult" class="mt-16"></div>
            </div>
        `;
        document.getElementById('importForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const fileInput = document.getElementById('importFile');
            const file = fileInput.files[0];
            if (!file) return UI.showToast('Select a file.', 'error');
            const reader = new FileReader();
            reader.onload = function(ev) {
                const content = ev.target.result;
                let rows = [];
                const lines = content.split('\n').filter(l => l.trim());
                if (lines.length < 2) return UI.showToast('File must contain header row and data.', 'error');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const required = ['first_name', 'last_name', 'email', 'password'];
                const missing = required.filter(r => !headers.includes(r));
                if (missing.length) {
                    document.getElementById('importResult').innerHTML = `<div class="text-danger">❌ Missing columns: ${missing.join(', ')}</div>`;
                    return;
                }
                for (let i = 1; i < lines.length; i++) {
                    const vals = lines[i].split(',').map(v => v.trim());
                    const row = {};
                    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
                    rows.push(row);
                }
                try {
                    const added = ImportService.importUsers(rows);
                    document.getElementById('importResult').innerHTML = `<div class="text-success">✅ Imported ${added} users successfully.</div>`;
                } catch (err) {
                    document.getElementById('importResult').innerHTML = `<div class="text-danger">❌ Error: ${err.message}</div>`;
                }
            };
            reader.readAsText(file);
        });
    }

    // ---- Audit ----
    function renderAudit() {
        const logs = DataService.getAuditLogs();
        main.innerHTML = `
            <h2>📋 Audit Logs</h2>
            <div class="card">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Event</th><th>Actor</th><th>Details</th><th>Timestamp</th></tr></thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr>
                                    <td>${log.event}</td>
                                    <td>${log.actor}</td>
                                    <td>${log.details}</td>
                                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                            ${logs.length===0 ? '<tr><td colspan="4" class="text-center text-muted">No logs.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ---- Support ----
    function renderAdminSupport() {
        const tickets = DataService.getSupportTickets();
        main.innerHTML = `
            <h2>📞 Support Tickets</h2>
            <div class="card">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>ID</th><th>User</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${tickets.map(t => {
                                const u = UserService.getUser(t.userId);
                                return `<tr>
                                    <td>${t.id}</td>
                                    <td>${u ? u.email : 'Unknown'}</td>
                                    <td>${t.subject}</td>
                                    <td><span class="badge badge-${t.status==='open'?'warning':t.status==='resolved'?'success':'muted'}">${t.status}</span></td>
                                    <td>
                                        <button class="btn btn-success btn-sm" onclick="resolveTicket(${t.id})">Resolve</button>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    window.resolveTicket = function(id) {
        const tickets = DataService.getSupportTickets();
        const idx = tickets.findIndex(t => t.id === id);
        if (idx === -1) return;
        tickets[idx].status = 'resolved';
        DataService.setSupportTickets(tickets);
        UI.showToast('Ticket resolved.', 'success');
        renderAdminSupport();
        AuthService._audit('TICKET_RESOLVED', `Admin resolved ticket ${id}`, null);
    };

    // ---- Settings ----
    function renderSettings() {
        main.innerHTML = `
            <h2>⚙️ Settings</h2>
            <div class="card">
                <p class="text-muted">System settings (placeholder).</p>
                <button class="btn btn-gold" onclick="UI.showToast('Settings saved!', 'success')">Save</button>
            </div>
        `;
    }

    // ---- Hash change ----
    window.addEventListener('hashchange', render);
    window.addEventListener('load', render);
})();
