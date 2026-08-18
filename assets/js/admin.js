// =============================================
// admin.js – Admin Portal (ALL features)
// =============================================
(function() {
    const user = getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return; }
    if (user.role !== 'admin' && user.role !== 'super_admin') { window.location.href = 'user.html'; return; }

    const main = document.getElementById('main-content');
    if (!main) return;

    function render() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        switch(hash) {
            case 'dashboard': renderDashboard(); break;
            case 'winners': renderWinners(); break;
            case 'schedules': renderSchedules(); break;
            case 'add-funds': renderAddFunds(); break;
            case 'audit': renderAudit(); break;
            case 'support': renderAdminSupport(); break;
            case 'settings': renderSettings(); break;
            case 'kyc-review': renderKycReview(); break;
            case 'withdrawals-review': renderWithdrawalsReview(); break;
            case 'announcements': renderAnnouncements(); break;
            case 'import': renderImport(); break;
            default: renderDashboard();
        }
    }

    // ---- Dashboard with charts ----
    function renderDashboard() {
        const users = getUsers();
        const total = users.filter(u => u.role === 'user').length;
        const active = users.filter(u => u.role === 'user' && u.status === 'active').length;
        const vip = users.filter(u => u.role === 'user' && u.vip_level !== 'Standard').length;
        const totalFunds = users.reduce((sum, u) => sum + u.balance + u.prize_amount, 0);
        const schedules = getFundingSchedules().filter(s => s.status === 'active');
        const pendingKyc = getKyc().filter(k => k.status === 'pending').length;
        const pendingWithdrawals = getWithdrawals().filter(w => w.status === 'pending').length;
        main.innerHTML = `
            <h2>🔧 Admin Dashboard</h2>
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
                ${getAuditLogs().slice(0,5).map(log => `
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
            if (vipCtx) {
                const vipCounts = {};
                users.filter(u => u.role === 'user').forEach(u => { vipCounts[u.vip_level] = (vipCounts[u.vip_level] || 0) + 1; });
                new Chart(vipCtx, {
                    type: 'pie',
                    data: { labels: Object.keys(vipCounts), datasets: [{ data: Object.values(vipCounts), backgroundColor: ['#ffd700','#8e44ad','#3498db','#2ecc71','#e74c3c'] }] },
                    options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } } }
                });
            }
            const txCtx = document.getElementById('txChart');
            if (txCtx) {
                const now = new Date();
                const last30 = [];
                for (let i = 29; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().slice(0,10);
                    const total = getFundingRecords().filter(f => f.createdAt.startsWith(dateStr)).reduce((s, f) => s + f.amount, 0);
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

    // ---- Winners with search/filter ----
    function renderWinners() {
        const users = getUsers().filter(u => u.role === 'user');
        main.innerHTML = `
            <h2>👤 Winners</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
                <input type="text" id="winnerSearch" placeholder="Search name, email, ID" oninput="window.filterWinners()" style="flex:1;min-width:200px;padding:8px;border-radius:8px;border:2px solid #2a2a5a;background:#0f0f22;color:#fff;" />
                <select id="vipFilter" onchange="window.filterWinners()" style="padding:8px;border-radius:8px;border:2px solid #2a2a5a;background:#0f0f22;color:#fff;">
                    <option value="">All VIP</option>
                    <option value="Standard">Standard</option>
                    <option value="VIP">VIP</option>
                    <option value="VIP Gold">VIP Gold</option>
                    <option value="VIP Platinum">VIP Platinum</option>
                    <option value="VIP Elite">VIP Elite</option>
                </select>
                <select id="statusFilter" onchange="window.filterWinners()" style="padding:8px;border-radius:8px;border:2px solid #2a2a5a;background:#0f0f22;color:#fff;">
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
                                    <td><select onchange="window.changeVIP(${u.id}, this.value)" class="form-control" style="background:#0f0f22;color:#fff;border:1px solid #2a2a5a;padding:4px 8px;border-radius:4px;">
                                        <option value="Standard" ${u.vip_level==='Standard'?'selected':''}>Standard</option>
                                        <option value="VIP" ${u.vip_level==='VIP'?'selected':''}>VIP</option>
                                        <option value="VIP Gold" ${u.vip_level==='VIP Gold'?'selected':''}>VIP Gold</option>
                                        <option value="VIP Platinum" ${u.vip_level==='VIP Platinum'?'selected':''}>VIP Platinum</option>
                                        <option value="VIP Elite" ${u.vip_level==='VIP Elite'?'selected':''}>VIP Elite</option>
                                    </select></td>
                                    <td><span class="badge badge-${u.status==='active'?'success':'danger'}">${u.status}</span></td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm" onclick="window.viewWinner(${u.id})">View</button>
                                        <button class="btn btn-danger btn-sm" onclick="window.suspendUser(${u.id})">Suspend</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
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

    // ---- KYC Review ----
    function renderKycReview() {
        const kycs = getKyc().filter(k => k.status === 'pending');
        main.innerHTML = `
            <h2>🪪 KYC Review</h2>
            ${kycs.map(k => {
                const u = getUsers().find(u => u.id === k.userId);
                return `
                    <div class="card mb-16">
                        <div class="flex-between">
                            <div><strong>${u ? u.firstName + ' ' + u.lastName : 'Unknown'}</strong> (${u ? u.email : ''})</div>
                            <div><span class="badge badge-warning">Pending</span></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0;">
                            <img src="${k.frontImage}" style="max-width:100%;max-height:120px;border-radius:8px;" />
                            <img src="${k.backImage}" style="max-width:100%;max-height:120px;border-radius:8px;" />
                            <img src="${k.selfieImage}" style="max-width:100%;max-height:120px;border-radius:8px;" />
                        </div>
                        <div>
                            <button class="btn btn-success btn-sm" onclick="window.approveKyc(${k.id})">✅ Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="window.rejectKyc(${k.id})">❌ Reject</button>
                        </div>
                    </div>
                `;
            }).join('') || '<p class="text-muted">No pending KYC submissions.</p>'}
        `;
        window.approveKyc = function(id) {
            const kycs = getKyc();
            const idx = kycs.findIndex(k => k.id === id);
            if (idx !== -1) {
                kycs[idx].status = 'approved';
                kycs[idx].approvedAt = new Date().toISOString();
                setKyc(kycs);
                audit('KYC_APPROVED', `Admin approved KYC for user ${kycs[idx].userId}`, getCurrentUser().id);
                alert('KYC approved.');
                renderKycReview();
            }
        };
        window.rejectKyc = function(id) {
            if (!confirm('Reject this KYC?')) return;
            const kycs = getKyc();
            const idx = kycs.findIndex(k => k.id === id);
            if (idx !== -1) {
                kycs[idx].status = 'rejected';
                setKyc(kycs);
                audit('KYC_REJECTED', `Admin rejected KYC for user ${kycs[idx].userId}`, getCurrentUser().id);
                alert('KYC rejected.');
                renderKycReview();
            }
        };
    }

    // ---- Withdrawals Review ----
    function renderWithdrawalsReview() {
        const withdrawals = getWithdrawals().filter(w => w.status === 'pending');
        main.innerHTML = `
            <h2>💳 Withdrawals Review</h2>
            ${withdrawals.map(w => {
                const u = getUsers().find(u => u.id === w.userId);
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
                            <button class="btn btn-success btn-sm" onclick="window.approveWithdrawal(${w.id})">✅ Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="window.rejectWithdrawal(${w.id})">❌ Reject</button>
                        </div>
                    </div>
                `;
            }).join('') || '<p class="text-muted">No pending withdrawals.</p>'}
        `;
        window.approveWithdrawal = function(id) {
            const withdrawals = getWithdrawals();
            const idx = withdrawals.findIndex(w => w.id === id);
            if (idx !== -1) {
                withdrawals[idx].status = 'approved';
                // Deduct balance
                const w = withdrawals[idx];
                const users = getUsers();
                const uIdx = users.findIndex(u => u.id === w.userId);
                if (uIdx !== -1) {
                    const total = users[uIdx].balance + users[uIdx].prize_amount;
                    if (total >= w.amount) {
                        // Deduct from balance first, then prize_amount
                        let remaining = w.amount;
                        if (users[uIdx].balance >= remaining) {
                            users[uIdx].balance -= remaining;
                        } else {
                            remaining -= users[uIdx].balance;
                            users[uIdx].balance = 0;
                            users[uIdx].prize_amount -= remaining;
                        }
                        setUsers(users);
                        // Funding record for withdrawal
                        const funding = getFundingRecords();
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
                        setFundingRecords(funding);
                        // Notification
                        const notifs = getNotifications();
                        notifs.push({
                            id: Date.now(),
                            userId: w.userId,
                            title: '✅ Withdrawal Approved',
                            message: `Your withdrawal of $${w.amount.toFixed(2)} has been approved.`,
                            isRead: false,
                            createdAt: new Date().toISOString()
                        });
                        setNotifications(notifs);
                        audit('WITHDRAWAL_APPROVED', `Admin approved withdrawal ${w.id} for user ${w.userId}`, getCurrentUser().id);
                        alert('Withdrawal approved and processed.');
                    } else {
                        alert('Insufficient balance to complete withdrawal.');
                        return;
                    }
                }
                setWithdrawals(withdrawals);
                renderWithdrawalsReview();
            }
        };
        window.rejectWithdrawal = function(id) {
            if (!confirm('Reject this withdrawal?')) return;
            const withdrawals = getWithdrawals();
            const idx = withdrawals.findIndex(w => w.id === id);
            if (idx !== -1) {
                withdrawals[idx].status = 'rejected';
                setWithdrawals(withdrawals);
                audit('WITHDRAWAL_REJECTED', `Admin rejected withdrawal ${id}`, getCurrentUser().id);
                alert('Withdrawal rejected.');
                renderWithdrawalsReview();
            }
        };
    }

    // ---- Announcements ----
    function renderAnnouncements() {
        const announcements = getAnnouncements();
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
            const announcements = getAnnouncements();
            announcements.push({
                id: Date.now(),
                title,
                message,
                createdAt: new Date().toISOString()
            });
            setAnnouncements(announcements);
            audit('ANNOUNCEMENT_CREATED', `Admin created announcement: ${title}`, getCurrentUser().id);
            alert('Announcement posted.');
            renderAnnouncements();
        });
    }

    // ---- Import (bulk upload) ----
    function renderImport() {
        main.innerHTML = `
            <h2>📂 Bulk Import Users</h2>
            <div class="card">
                <p class="text-muted">Upload a CSV, TXT, XML, or PDF file with user data. Required columns: first_name, last_name, email, password. Optional: balance, vip_level, status, phone, address.</p>
                <form id="importForm">
                    <div class="form-group"><label>File (CSV/TXT/XML/PDF)</label><input type="file" id="importFile" accept=".csv,.txt,.xml,.pdf" required /></div>
                    <button type="submit" class="btn btn-gold">Import Users</button>
                </form>
                <div id="importResult"></div>
            </div>
        `;
        document.getElementById('importForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const fileInput = document.getElementById('importFile');
            const file = fileInput.files[0];
            if (!file) { alert('Select a file.'); return; }
            const reader = new FileReader();
            reader.onload = function(ev) {
                const content = ev.target.result;
                let rows = [];
                // Simple CSV parsing (for demo)
                const lines = content.split('\n').filter(l => l.trim());
                if (lines.length < 2) { alert('File must contain header row and data.'); return; }
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const required = ['first_name', 'last_name', 'email', 'password'];
                const missing = required.filter(r => !headers.includes(r));
                if (missing.length > 0) {
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
                    const added = importUsers(rows);
                    document.getElementById('importResult').innerHTML = `<div class="text-success">✅ Imported ${added} users successfully.</div>`;
                    audit('ADMIN_IMPORT', `Admin imported ${added} users`, getCurrentUser().id);
                } catch (err) {
                    document.getElementById('importResult').innerHTML = `<div class="text-danger">❌ Error: ${err.message}</div>`;
                }
            };
            reader.readAsText(file);
        });
    }

    // ---- Schedules (with weekly/monthly) ----
    function renderSchedules() {
        const schedules = getFundingSchedules();
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
                        <button class="btn btn-secondary btn-sm" onclick="window.toggleSchedule(${s.id})">${s.status==='active'?'Pause':'Resume'}</button>
                    </div>
                `).join('') || '<p class="text-muted">No schedules.</p>'}
            </div>
        `;
        document.getElementById('scheduleForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('scheduleName').value;
            const amount = parseFloat(document.getElementById('scheduleAmount').value);
            const frequency = document.getElementById('scheduleFrequency').value;
            const schedules = getFundingSchedules();
            schedules.push({
                id: Date.now(),
                name,
                amount,
                frequency,
                day: frequency === 'weekly' ? 'Friday' : '1st',
                status: 'active',
                createdAt: new Date().toISOString()
            });
            setFundingSchedules(schedules);
            audit('FUNDING_SCHEDULE_CREATED', `Admin created ${frequency} schedule: ${name} $${amount}`, getCurrentUser().id);
            alert('Schedule created!');
            renderSchedules();
        });
    }
    window.toggleSchedule = function(id) {
        const schedules = getFundingSchedules();
        const idx = schedules.findIndex(s => s.id === id);
        if (idx !== -1) {
            schedules[idx].status = schedules[idx].status === 'active' ? 'paused' : 'active';
            setFundingSchedules(schedules);
            audit('SCHEDULE_TOGGLED', `Admin toggled schedule ${id} to ${schedules[idx].status}`, getCurrentUser().id);
            renderSchedules();
        }
    };

    // ---- Add Funds ----
    function renderAddFunds() {
        const users = getUsers().filter(u => u.role === 'user');
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
            if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
            const users = getUsers();
            const idx = users.findIndex(u => u.id === userId);
            if (idx !== -1) {
                users[idx].balance += amount;
                users[idx].prize_amount += amount;
                setUsers(users);
                const funding = getFundingRecords();
                funding.push({
                    id: Date.now(),
                    userId: userId,
                    amount: amount,
                    type: 'manual',
                    status: 'completed',
                    description: desc,
                    reference: 'MANUAL-' + Date.now(),
                    createdAt: new Date().toISOString()
                });
                setFundingRecords(funding);
                const notifs = getNotifications();
                notifs.push({
                    id: Date.now(),
                    userId: userId,
                    title: '💰 Funds Added',
                    message: `$${amount} has been added to your account.`,
                    isRead: false,
                    createdAt: new Date().toISOString()
                });
                setNotifications(notifs);
                audit('FUNDS_ADDED', `Admin added $${amount} to user ${users[idx].email}`, getCurrentUser().id);
                alert('Funds added!');
                renderAddFunds();
            }
        });
    }

    // ---- Audit ----
    function renderAudit() {
        const logs = getAuditLogs();
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

    // ---- Admin Support ----
    function renderAdminSupport() {
        const tickets = getSupportTickets();
        main.innerHTML = `
            <h2>📞 Support Tickets</h2>
            <div class="card">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>ID</th><th>User</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${tickets.map(t => {
                                const u = getUsers().find(u => u.id === t.userId);
                                return `<tr>
                                    <td>${t.id}</td>
                                    <td>${u ? u.email : 'Unknown'}</td>
                                    <td>${t.subject}</td>
                                    <td><span class="badge badge-${t.status==='open'?'warning':t.status==='resolved'?'success':'muted'}">${t.status}</span></td>
                                    <td>
                                        <button class="btn btn-success btn-sm" onclick="window.resolveTicket(${t.id})">Resolve</button>
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
        const tickets = getSupportTickets();
        const idx = tickets.findIndex(t => t.id === id);
        if (idx !== -1) {
            tickets[idx].status = 'resolved';
            setSupportTickets(tickets);
            audit('TICKET_RESOLVED', `Admin resolved ticket ${id}`, getCurrentUser().id);
            alert('Ticket resolved.');
            renderAdminSupport();
        }
    };

    // ---- Settings ----
    function renderSettings() {
        main.innerHTML = `
            <h2>⚙️ Settings</h2>
            <div class="card">
                <p class="text-muted">System settings (placeholder).</p>
                <button class="btn btn-gold" onclick="alert('Settings saved!')">Save</button>
            </div>
        `;
    }

    // ---- Navigation helper ----
    window.changeVIP = function(userId, newLevel) {
        const users = getUsers();
        const idx = users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            const old = users[idx].vip_level;
            users[idx].vip_level = newLevel;
            setUsers(users);
            audit('VIP_CHANGED', `Admin changed VIP of ${users[idx].email} from ${old} to ${newLevel}`, getCurrentUser().id);
            alert(`VIP level updated to ${newLevel}`);
            renderWinners();
        }
    };
    window.suspendUser = function(id) {
        if (!confirm('Suspend this user?')) return;
        const users = getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx !== -1) {
            users[idx].status = 'suspended';
            setUsers(users);
            audit('USER_SUSPENDED', `Admin suspended user ${users[idx].email}`, getCurrentUser().id);
            alert('User suspended.');
            renderWinners();
        }
    };
    window.viewWinner = function(userId) {
        const u = getUsers().find(u => u.id === userId);
        if (!u) return alert('User not found');
        const funds = getFundingRecords().filter(f => f.userId === userId);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-box" style="max-width:600px;">
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h3>👤 ${u.firstName} ${u.lastName}</h3>
                <p>Email: ${u.email} • VIP: ${u.vip_level} • Status: ${u.status}</p>
                <p>Balance: $${(u.balance+u.prize_amount).toFixed(2)}</p>
                <h4 style="color:#ffd700;margin-top:12px;">Funding History</h4>
                <div style="max-height:300px;overflow-y:auto;">
                    ${funds.map(f => `
                        <div class="flex-between" style="padding:6px 0;border-bottom:1px solid #1a1a3e;cursor:pointer;" onclick="window.showAdminTransaction(${f.id})">
                            <span>${f.description}</span>
                            <span>$${f.amount.toFixed(2)}</span>
                            <span class="text-muted">${new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                    `).join('') || '<p class="text-muted">No funding.</p>'}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) { if (e.target === this) this.remove(); });
        audit('ADMIN_VIEWED_WINNER', `Admin viewed winner ${u.email}`, getCurrentUser().id);
    };
    window.showAdminTransaction = function(id) {
        const fund = getFundingRecords().find(f => f.id === id);
        if (!fund) return;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-box">
                <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h3>📄 Transaction Details</h3>
                <div class="detail-row"><span class="label">ID</span><span class="value">${fund.id}</span></div>
                <div class="detail-row"><span class="label">User</span><span class="value">${getUsers().find(u=>u.id===fund.userId)?.email || 'Unknown'}</span></div>
                <div class="detail-row"><span class="label">Date</span><span class="value">${new Date(fund.createdAt).toLocaleString()}</span></div>
                <div class="detail-row"><span class="label">Amount</span><span class="value">$${fund.amount.toFixed(2)}</span></div>
                <div class="detail-row"><span class="label">Type</span><span class="value">${fund.type}</span></div>
                <div class="detail-row"><span class="label">Description</span><span class="value">${fund.description}</span></div>
                <div class="detail-row"><span class="label">Status</span><span class="value"><span class="badge badge-${fund.status==='completed'?'success':'warning'}">${fund.status}</span></span></div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) { if (e.target === this) this.remove(); });
        audit('ADMIN_VIEWED_TRANSACTION', `Admin viewed transaction ${fund.id}`, getCurrentUser().id);
    };

    window.addEventListener('hashchange', render);
    window.addEventListener('load', render);
})();