// =============================================
// USER.JS – User Portal Application
// =============================================

(function() {
    // ---- Check authentication ----
    if (!AuthService.requireAuth()) return;

    const user = AuthService.getCurrentUser();
    if (!user) return;
    if (user.role === 'admin' || user.role === 'super_admin') {
        window.location.href = 'admin.html';
        return;
    }

    const main = document.getElementById('main-content');
    if (!main) return;

    // ---- Render based on hash ----
    function render() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        switch(hash) {
            case 'dashboard': renderDashboard(); break;
            case 'funding': renderFunding(); break;
            case 'cards': renderCards(); break;
            case 'rewards': renderRewards(); break;
            case 'support': renderSupport(); break;
            case 'kyc': renderKyc(); break;
            case 'withdrawals': renderWithdrawals(); break;
            case 'transfers': renderTransfers(); break;
            case 'activity': renderActivity(); break;
            case 'security': renderSecurity(); break;
            case 'profile': renderProfile(); break;
            case 'settings': renderSettings(); break;
            default: renderDashboard();
        }
    }

    // ---- Dashboard ----
    function renderDashboard() {
        const total = user.balance + user.prize_amount;
        const funds = TransactionService.getTransactions(user.id).slice(0,5);
        const notifs = DataService.getNotifications().filter(n => n.userId === user.id && !n.isRead);
        const nextFunding = getNextFundingDate();
        const countdown = Math.ceil((nextFunding - new Date()) / (1000*60*60*24));
        const announcements = AnnouncementService.getAll();

        main.innerHTML = `
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;align-items:center;margin-bottom:16px;">
                <div>
                    <h2>👋 Welcome, ${user.firstName} ${user.lastName}</h2>
                    <p class="text-muted">Winner ID: ${user.accountNumber} • VIP: ${user.vip_level}</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:14px;color:#ffd700;">⏳ Next Funding in ${countdown} day${countdown>1?'s':''}</div>
                </div>
            </div>
            <div class="card card-glow mb-24">
                <div class="text-muted">💰 Available Winner Funds</div>
                <div style="font-size:48px;font-weight:800;color:#ffd700;">${Formatters.currency(total)}</div>
                <div class="text-muted">Account: ${user.accountNumber}</div>
                <div style="margin-top:8px;color:#2ecc71;">Next Funding: ${nextFunding.toLocaleDateString()} • $7,000</div>
            </div>
            <div class="grid-3 mb-24">
                <div class="stat-card"><div class="number">${Formatters.currency(total)}</div><div class="label">Available</div></div>
                <div class="stat-card"><div class="number">${Formatters.currency(0)}</div><div class="label">Pending</div></div>
                <div class="stat-card"><div class="number">${user.vip_level}</div><div class="label">VIP Level</div></div>
            </div>
            <div class="card mb-24">
                <h4 style="color:#ffd700;">📊 Funding Trend (last 12 weeks)</h4>
                <canvas id="fundingChart" height="200"></canvas>
            </div>
            <div class="grid-2 mb-24">
                <div class="card">
                    <h4 style="color:#ffd700;">📋 Recent Funding</h4>
                    ${funds.map(f => `
                        <div class="flex-between" style="padding:8px 0;border-bottom:1px solid #1a1a3e;cursor:pointer;" onclick="showTransactionDetail(${f.id})">
                            <span>${f.description}</span>
                            <span class="text-success">+${Formatters.currency(f.amount)}</span>
                            <span class="text-muted">${new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                    `).join('') || '<p class="text-muted">No funding yet.</p>'}
                    <a href="#funding" class="btn btn-secondary btn-sm mt-8">View All →</a>
                </div>
                <div class="card">
                    <h4 style="color:#ffd700;">📢 Announcements</h4>
                    ${announcements.slice(0,3).map(a => `
                        <div style="padding:8px 0;border-bottom:1px solid #1a1a3e;">
                            <strong>${a.title}</strong><br/>
                            <span class="text-muted">${a.message}</span>
                            <span class="text-muted" style="font-size:11px;">${new Date(a.createdAt).toLocaleDateString()}</span>
                        </div>
                    `).join('') || '<p class="text-muted">No announcements.</p>'}
                </div>
            </div>
            <div class="card mt-16">
                <h4 style="color:#ffd700;">🔔 Notifications (${notifs.length} unread)</h4>
                ${notifs.slice(0,3).map(n => `
                    <div class="flex-between" style="padding:6px 0;border-bottom:1px solid #1a1a3e;">
                        <span><strong>${n.title}</strong><br/><span class="text-muted">${n.message}</span></span>
                        <span class="badge badge-info">Unread</span>
                    </div>
                `).join('') || '<p class="text-muted">No notifications.</p>'}
                <div style="margin-top:8px;">
                    <button class="btn btn-secondary btn-sm" onclick="markAllRead()">Mark All Read</button>
                    <button class="btn btn-secondary btn-sm" onclick="askNotificationPermission()">🔔 Enable Push</button>
                </div>
            </div>
        `;

        // ---- Chart ----
        const ctx = document.getElementById('fundingChart');
        if (ctx && typeof Chart !== 'undefined') {
            const weeks = TransactionService.getTransactions(user.id).slice(0,12).reverse();
            const labels = weeks.map(f => new Date(f.createdAt).toLocaleDateString());
            const data = weeks.map(f => f.amount);
            new Chart(ctx, {
                type: 'bar',
                data: { labels, datasets: [{ label: 'Funding ($)', data, backgroundColor: '#ffd700' }] },
                options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
            });
        }
    }

    // ---- Transaction Detail ----
    window.showTransactionDetail = function(id) {
        const fund = TransactionService.getTransaction(id);
        if (!fund) return UI.showToast('Transaction not found', 'error');
        UI.showModal({
            title: '📄 Transaction Details',
            body: `
                <div class="detail-row"><span class="label">ID</span><span class="value">${fund.id}</span></div>
                <div class="detail-row"><span class="label">Date</span><span class="value">${new Date(fund.createdAt).toLocaleString()}</span></div>
                <div class="detail-row"><span class="label">Amount</span><span class="value">${Formatters.currency(fund.amount)}</span></div>
                <div class="detail-row"><span class="label">Type</span><span class="value">${fund.type}</span></div>
                <div class="detail-row"><span class="label">Description</span><span class="value">${fund.description}</span></div>
                <div class="detail-row"><span class="label">Reference</span><span class="value">${fund.reference || 'N/A'}</span></div>
                <div class="detail-row"><span class="label">Status</span><span class="value"><span class="badge badge-${fund.status==='completed'?'success':'warning'}">${fund.status}</span></span></div>
            `,
            buttons: [{ label: 'Close', class: 'btn-secondary', action: 'close' }],
            callbacks: { close: () => UI.closeModal() }
        });
        AuthService._audit('TRANSACTION_VIEWED', `User ${user.email} viewed transaction ${id}`, user.id);
    };

    // ---- Funding History ----
    function renderFunding() {
        const funds = TransactionService.getTransactions(user.id);
        main.innerHTML = `
            <h2>💰 Funding History</h2>
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
                <div>
                    <input type="text" id="fundingSearch" placeholder="Search description/reference" oninput="filterFunding()" style="padding:8px;border-radius:8px;border:2px solid #2a2a5a;background:#0f0f22;color:#fff;" />
                    <select id="fundingTypeFilter" onchange="filterFunding()" style="padding:8px;border-radius:8px;border:2px solid #2a2a5a;background:#0f0f22;color:#fff;">
                        <option value="">All Types</option>
                        <option value="welcome">Welcome</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="manual">Manual</option>
                        <option value="transfer_in">Transfer In</option>
                        <option value="transfer_out">Transfer Out</option>
                    </select>
                </div>
                <div>
                    <button class="btn btn-csv" onclick="exportCSV()">📥 CSV</button>
                    <button class="btn btn-secondary" onclick="exportPDF()">📄 PDF</button>
                </div>
            </div>
            <div class="card" id="fundingTableContainer">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                        <tbody id="fundingTableBody">
                            ${funds.map(f => `
                                <tr style="cursor:pointer;" onclick="showTransactionDetail(${f.id})">
                                    <td>${new Date(f.createdAt).toLocaleDateString()}</td>
                                    <td>${f.description}</td>
                                    <td class="${f.amount < 0 ? 'text-danger' : 'text-success'}">${f.amount < 0 ? '-' : '+'}${Formatters.currency(Math.abs(f.amount))}</td>
                                    <td><span class="badge badge-${f.status==='completed'?'success':'warning'}">${f.status}</span></td>
                                </tr>
                            `).join('')}
                            ${funds.length===0 ? '<tr><td colspan="4" class="text-center text-muted">No funding yet.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        window.filterFunding = function() {
            const search = document.getElementById('fundingSearch').value.toLowerCase();
            const type = document.getElementById('fundingTypeFilter').value;
            const rows = document.querySelectorAll('#fundingTableBody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const rowType = row.querySelector('td:nth-child(2)')?.textContent || '';
                let show = true;
                if (search && !text.includes(search)) show = false;
                if (type && !rowType.includes(type)) show = false;
                row.style.display = show ? '' : 'none';
            });
        };
        window.exportCSV = function() {
            const funds = TransactionService.getTransactions(user.id);
            if (!funds.length) return UI.showToast('No data to export.', 'error');
            let csv = 'ID,Date,Description,Amount,Type,Status,Reference\n';
            funds.forEach(f => {
                csv += `${f.id},${new Date(f.createdAt).toLocaleString()},${f.description},${f.amount},${f.type},${f.status},${f.reference||''}\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `funding_${new Date().toISOString().slice(0,10)}.csv`;
            link.click();
            UI.showToast('CSV exported.', 'success');
            AuthService._audit('CSV_EXPORTED', `User ${user.email} exported CSV`, user.id);
        };
        window.exportPDF = function() {
            const element = document.getElementById('fundingTableContainer');
            if (!element) return;
            html2pdf().from(element).save(`funding_${new Date().toISOString().slice(0,10)}.pdf`);
            UI.showToast('PDF exported.', 'success');
            AuthService._audit('PDF_EXPORTED', `User ${user.email} exported PDF`, user.id);
        };
    }

    // ---- Cards ----
    function renderCards() {
        const cards = DataService.getCards().filter(c => c.userId === user.id);
        main.innerHTML = `
            <h2>💳 My Cards</h2>
            <div class="card">
                <h4 style="color:#ffd700;">Add New Card</h4>
                <form id="addCardForm">
                    <div class="form-group"><label>Card Number</label><input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" required /></div>
                    <div class="form-row">
                        <div class="form-group"><label>Expiry</label><input type="text" id="cardExpiry" placeholder="MM/YY" required /></div>
                        <div class="form-group"><label>CVV</label><input type="password" id="cardCvv" placeholder="123" required /></div>
                    </div>
                    <div class="form-group"><label>Cardholder Name</label><input type="text" id="cardName" required /></div>
                    <button type="submit" class="btn btn-gold">Add Card</button>
                </form>
            </div>
            <div class="grid-3 mt-16">
                ${cards.map(c => `
                    <div class="card" style="border-left:4px solid #ffd700;">
                        <div class="flex-between">
                            <span class="badge badge-${c.status==='active'?'success':'danger'}">${c.status}</span>
                            <button class="btn btn-danger btn-sm" onclick="removeCard(${c.id})">✕</button>
                        </div>
                        <div style="font-family:monospace;font-size:18px;letter-spacing:2px;margin:10px 0;">•••• •••• •••• ${c.last4}</div>
                        <div class="flex-between"><span>${c.cardholderName}</span><span>${c.expiry}</span></div>
                    </div>
                `).join('')}
                ${cards.length===0 ? '<div class="card"><p class="text-muted">No cards.</p></div>' : ''}
            </div>
        `;
        document.getElementById('addCardForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const number = document.getElementById('cardNumber').value.replace(/\s/g,'');
            const expiry = document.getElementById('cardExpiry').value;
            const cvv = document.getElementById('cardCvv').value;
            const name = document.getElementById('cardName').value;
            if (number.length < 16) return UI.showToast('Invalid card number.', 'error');
            const last4 = number.slice(-4);
            const cards = DataService.getCards();
            cards.push({
                id: Date.now(),
                userId: user.id,
                last4,
                cardholderName: name,
                expiry,
                status: 'active',
                createdAt: new Date().toISOString()
            });
            DataService.setCards(cards);
            UI.showToast('Card added!', 'success');
            renderCards();
            AuthService._audit('CARD_ADDED', `User ${user.email} added card ending in ${last4}`, user.id);
        });
    }

    window.removeCard = function(cardId) {
        if (!confirm('Remove this card?')) return;
        let cards = DataService.getCards();
        cards = cards.filter(c => c.id !== cardId);
        DataService.setCards(cards);
        UI.showToast('Card removed.', 'success');
        renderCards();
        AuthService._audit('CARD_REMOVED', `User ${user.email} removed card ${cardId}`, user.id);
    };

    // ---- Rewards ----
    function renderRewards() {
        const rewards = DataService.getRewards().filter(r => r.userId === user.id);
        main.innerHTML = `
            <h2>🎁 My Rewards</h2>
            ${rewards.map(r => `
                <div class="card mb-16">
                    <div class="flex-between"><div><strong>${r.name}</strong><br/><span class="text-muted">${r.description}</span></div><div class="text-success">+${Formatters.currency(r.amount)}</div></div>
                    <div class="flex-between"><span class="badge badge-${r.status==='approved'?'success':'warning'}">${r.status}</span><span class="text-muted">${new Date(r.createdAt).toLocaleDateString()}</span></div>
                </div>
            `).join('') || '<div class="empty-state"><div class="icon">🎁</div><div>No rewards yet.</div></div>'}
        `;
    }

    // ---- Support ----
    function renderSupport() {
        const tickets = DataService.getSupportTickets().filter(t => t.userId === user.id);
        main.innerHTML = `
            <h2>📞 Support</h2>
            <div class="card">
                <h4 style="color:#ffd700;">Create Ticket</h4>
                <form id="supportForm">
                    <div class="form-group"><label>Category</label>
                        <select id="ticketCategory">
                            <option value="general">General</option>
                            <option value="funding">Funding</option>
                            <option value="card">Card</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Subject</label><input type="text" id="ticketSubject" required /></div>
                    <div class="form-group"><label>Message</label><textarea id="ticketMessage" required></textarea></div>
                    <button type="submit" class="btn btn-gold">Submit</button>
                </form>
            </div>
            <div class="card mt-16">
                <h4 style="color:#ffd700;">Your Tickets</h4>
                ${tickets.map(t => `
                    <div class="flex-between" style="padding:8px 0;border-bottom:1px solid #1a1a3e;">
                        <div><strong>#${t.id}</strong> ${t.subject}<br/><span class="text-muted">${t.message}</span></div>
                        <span class="badge badge-${t.status==='open'?'warning':t.status==='resolved'?'success':'muted'}">${t.status}</span>
                    </div>
                `).join('') || '<p class="text-muted">No tickets.</p>'}
            </div>
        `;
        document.getElementById('supportForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const category = document.getElementById('ticketCategory').value;
            const subject = document.getElementById('ticketSubject').value;
            const message = document.getElementById('ticketMessage').value;
            const tickets = DataService.getSupportTickets();
            tickets.push({
                id: Date.now(),
                userId: user.id,
                category,
                subject,
                message,
                status: 'open',
                createdAt: new Date().toISOString()
            });
            DataService.setSupportTickets(tickets);
            UI.showToast('Ticket created!', 'success');
            renderSupport();
            AuthService._audit('SUPPORT_TICKET_CREATED', `User ${user.email} created ticket: ${subject}`, user.id);
        });
    }

    // ---- KYC ----
    function renderKyc() {
        const kycs = KycService.getForUser(user.id);
        const kyc = kycs[kycs.length - 1];
        const isVerified = kyc && kyc.status === 'approved';
        const isPending = kyc && kyc.status === 'pending';

        main.innerHTML = `
            <h2>🪪 KYC Verification</h2>
            ${isVerified ? `<div class="card" style="border-left:4px solid #2ecc71;"><p class="text-success">✅ Your KYC is verified. You can now withdraw funds.</p></div>` :
            isPending ? `<div class="card" style="border-left:4px solid #f39c12;"><p class="text-warning">⏳ Your KYC is under review. Please wait.</p></div>` :
            `<div class="card">
                <h4 style="color:#ffd700;">Submit KYC Documents</h4>
                <form id="kycForm">
                    <div class="form-group"><label>ID Type</label>
                        <select id="kycIdType">
                            <option value="passport">Passport</option>
                            <option value="drivers_license">Driver's License</option>
                            <option value="national_id">National ID</option>
                        </select>
                    </div>
                    <div class="form-group"><label>ID Number</label><input type="text" id="kycIdNumber" required /></div>
                    <div class="form-group"><label>Front of ID (image)</label><input type="file" id="kycFront" accept="image/*" required /></div>
                    <div class="form-group"><label>Back of ID (image)</label><input type="file" id="kycBack" accept="image/*" required /></div>
                    <div class="form-group"><label>Selfie holding ID</label><input type="file" id="kycSelfie" accept="image/*" required /></div>
                    <button type="submit" class="btn btn-gold">Submit KYC</button>
                </form>
            </div>`}
        `;
        if (!isVerified && !isPending) {
            document.getElementById('kycForm').addEventListener('submit', function(e) {
                e.preventDefault();
                const idType = document.getElementById('kycIdType').value;
                const idNumber = document.getElementById('kycIdNumber').value;
                const frontFile = document.getElementById('kycFront').files[0];
                const backFile = document.getElementById('kycBack').files[0];
                const selfieFile = document.getElementById('kycSelfie').files[0];
                if (!frontFile || !backFile || !selfieFile) return UI.showToast('Please upload all required images.', 'error');
                const reader = (file) => new Promise((resolve) => {
                    const r = new FileReader();
                    r.onload = (e) => resolve(e.target.result);
                    r.readAsDataURL(file);
                });
                Promise.all([reader(frontFile), reader(backFile), reader(selfieFile)]).then(([front, back, selfie]) => {
                    try {
                        KycService.submit(user.id, { idType, idNumber }, front, back, selfie);
                        UI.showToast('KYC submitted for review.', 'success');
                        renderKyc();
                    } catch (err) {
                        UI.showToast(err.message, 'error');
                    }
                });
            });
        }
    }

    // ---- Withdrawals ----
    function renderWithdrawals() {
        const isVerified = KycService.isVerified(user.id);
        if (!isVerified) {
            main.innerHTML = `<h2>💳 Withdrawals</h2><div class="card"><p class="text-danger">⚠️ You must complete KYC verification to withdraw funds.</p><a href="#kyc" class="btn btn-gold">Go to KYC</a></div>`;
            return;
        }
        const withdrawals = DataService.getWithdrawals().filter(w => w.userId === user.id);
        const cards = DataService.getCards().filter(c => c.userId === user.id);
        main.innerHTML = `
            <h2>💳 Withdrawals</h2>
            <div class="card">
                <h4 style="color:#ffd700;">New Withdrawal Request</h4>
                <form id="withdrawForm">
                    <div class="form-group"><label>Withdraw to</label>
                        <select id="withdrawMethod">
                            <option value="card">Card (saved)</option>
                            <option value="bank">Bank Account</option>
                        </select>
                    </div>
                    <div class="form-group" id="cardSelectGroup">
                        <label>Select Card</label>
                        <select id="withdrawCard">
                            ${cards.map(c => `<option value="${c.id}">****${c.last4} (${c.cardholderName})</option>`).join('')}
                            ${cards.length === 0 ? '<option value="">No cards saved – add one first</option>' : ''}
                        </select>
                    </div>
                    <div class="form-group" id="bankGroup" style="display:none;">
                        <label>Bank Account Details</label>
                        <input type="text" id="bankAccount" placeholder="Account number" />
                        <input type="text" id="bankRouting" placeholder="Routing number" style="margin-top:8px;" />
                    </div>
                    <div class="form-group"><label>Amount (${DataService.getCurrency()})</label><input type="number" id="withdrawAmount" step="0.01" min="1" required /></div>
                    <div class="form-group"><label>Description</label><input type="text" id="withdrawDesc" placeholder="Optional" /></div>
                    <button type="submit" class="btn btn-gold">Request Withdrawal</button>
                </form>
            </div>
            <div class="card mt-16">
                <h4 style="color:#ffd700;">Withdrawal History</h4>
                ${withdrawals.map(w => `
                    <div class="flex-between" style="padding:8px 0;border-bottom:1px solid #1a1a3e;">
                        <div><strong>${w.method}</strong><br/><span class="text-muted">${w.description || ''}</span></div>
                        <div><span class="${w.status==='approved'?'text-success':w.status==='rejected'?'text-danger':'text-warning'}">${w.status.toUpperCase()}</span></div>
                        <div>${Formatters.currency(w.amount)}</div>
                        <span class="text-muted">${new Date(w.createdAt).toLocaleDateString()}</span>
                    </div>
                `).join('') || '<p class="text-muted">No withdrawals.</p>'}
            </div>
        `;
        // Toggle card/bank
        document.getElementById('withdrawMethod').addEventListener('change', function() {
            document.getElementById('cardSelectGroup').style.display = this.value === 'card' ? 'block' : 'none';
            document.getElementById('bankGroup').style.display = this.value === 'bank' ? 'block' : 'none';
        });
        document.getElementById('withdrawForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const method = document.getElementById('withdrawMethod').value;
            let accountRef = '';
            if (method === 'card') {
                const cardId = document.getElementById('withdrawCard').value;
                if (!cardId) return UI.showToast('Please add a card first.', 'error');
                const card = cards.find(c => c.id == cardId);
                accountRef = 'Card ****' + card.last4;
            } else {
                const acc = document.getElementById('bankAccount').value;
                const routing = document.getElementById('bankRouting').value;
                if (!acc || !routing) return UI.showToast('Enter bank account details.', 'error');
                accountRef = 'Bank ****' + acc.slice(-4);
            }
            const amount = parseFloat(document.getElementById('withdrawAmount').value);
            const desc = document.getElementById('withdrawDesc').value || 'Withdrawal';
            if (!amount || amount <= 0) return UI.showToast('Enter a valid amount.', 'error');
            const total = user.balance + user.prize_amount;
            if (amount > total) return UI.showToast('Insufficient balance.', 'error');
            try {
                WithdrawalService.request(user.id, method, accountRef, amount, desc);
                UI.showToast('Withdrawal request submitted.', 'success');
                renderWithdrawals();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    // ---- Transfers ----
    function renderTransfers() {
        const isVerified = KycService.isVerified(user.id);
        if (!isVerified) {
            main.innerHTML = `<h2>💸 Transfers</h2><div class="card"><p class="text-danger">⚠️ You must complete KYC to transfer funds.</p><a href="#kyc" class="btn btn-gold">Go to KYC</a></div>`;
            return;
        }
        main.innerHTML = `
            <h2>💸 Internal Transfers</h2>
            <div class="card">
                <h4 style="color:#ffd700;">Send Money to Another PCH User</h4>
                <form id="transferForm">
                    <div class="form-group"><label>Search Recipient</label>
                        <input type="text" id="searchUser" placeholder="Search by name, email, or Winner ID" oninput="searchUsers(this.value)" />
                        <div id="searchResults" style="background:#0f0f22;border-radius:8px;margin-top:4px;max-height:150px;overflow-y:auto;"></div>
                    </div>
                    <div class="form-group"><label>Recipient</label>
                        <input type="text" id="recipientDisplay" readonly placeholder="Select from search" />
                        <input type="hidden" id="recipientId" />
                    </div>
                    <div class="form-group"><label>Amount (${DataService.getCurrency()})</label><input type="number" id="transferAmount" step="0.01" min="1" required /></div>
                    <div class="form-group"><label>Description</label><input type="text" id="transferDesc" placeholder="Optional" /></div>
                    <button type="submit" class="btn btn-gold">Send Transfer</button>
                </form>
            </div>
            <div class="card mt-16">
                <h4 style="color:#ffd700;">Transfer History</h4>
                <div id="transferHistory"></div>
            </div>
        `;
        // Search function
        window.searchUsers = function(query) {
            const results = document.getElementById('searchResults');
            if (!query.trim()) { results.innerHTML = ''; return; }
            const users = UserService.getWinners().filter(u => u.id !== user.id);
            const matched = users.filter(u =>
                u.firstName.toLowerCase().includes(query.toLowerCase()) ||
                u.lastName.toLowerCase().includes(query.toLowerCase()) ||
                u.email.toLowerCase().includes(query.toLowerCase()) ||
                u.accountNumber.toLowerCase().includes(query.toLowerCase())
            );
            results.innerHTML = matched.map(u =>
                `<div style="padding:8px;border-bottom:1px solid #1a1a3e;cursor:pointer;" onclick="selectRecipient(${u.id}, '${u.firstName} ${u.lastName} (${u.accountNumber})')">${u.firstName} ${u.lastName} (${u.accountNumber})</div>`
            ).join('') || '<div class="text-muted">No users found.</div>';
        };
        window.selectRecipient = function(id, display) {
            document.getElementById('recipientId').value = id;
            document.getElementById('recipientDisplay').value = display;
            document.getElementById('searchResults').innerHTML = '';
        };
        document.getElementById('transferForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const toId = parseInt(document.getElementById('recipientId').value);
            if (!toId) return UI.showToast('Please select a recipient.', 'error');
            const amount = parseFloat(document.getElementById('transferAmount').value);
            const desc = document.getElementById('transferDesc').value || 'Internal transfer';
            const total = user.balance + user.prize_amount;
            if (amount > total) return UI.showToast('Insufficient balance.', 'error');
            try {
                TransferService.createTransfer(user.id, toId, amount, desc);
                UI.showToast('Transfer sent!', 'success');
                renderTransfers();
                // Update current user balance (will be reflected after reload)
                const updatedUser = UserService.getUser(user.id);
                if (updatedUser) {
                    Object.assign(user, updatedUser);
                    AppState.set('user', user);
                }
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
        // Load transfer history
        const history = TransactionService.getTransactions(user.id).filter(f => f.type === 'transfer_out' || f.type === 'transfer_in');
        document.getElementById('transferHistory').innerHTML = history.map(f => `
            <div class="flex-between" style="padding:8px 0;border-bottom:1px solid #1a1a3e;">
                <span>${f.description}</span>
                <span class="${f.amount < 0 ? 'text-danger' : 'text-success'}">${f.amount < 0 ? '-' : '+'}${Formatters.currency(Math.abs(f.amount))}</span>
                <span class="text-muted">${new Date(f.createdAt).toLocaleDateString()}</span>
            </div>
        `).join('') || '<p class="text-muted">No transfers.</p>';
    }

    // ---- Activity ----
    function renderActivity() {
        const log = DataService.getActivityLog(user.id);
        main.innerHTML = `
            <h2>📋 Activity Log</h2>
            <div class="card">
                ${log.map(l => `
                    <div class="flex-between" style="padding:8px 0;border-bottom:1px solid #1a1a3e;">
                        <div><strong>${l.action}</strong><br/><span class="text-muted">${l.details}</span></div>
                        <span class="text-muted">${new Date(l.timestamp).toLocaleString()}</span>
                    </div>
                `).join('') || '<p class="text-muted">No activity yet.</p>'}
            </div>
        `;
    }

    // ---- Security ----
    function renderSecurity() {
        main.innerHTML = `
            <h2>🔒 Security</h2>
            <div class="card">
                <h4 style="color:#ffd700;">Change Password</h4>
                <form id="changePasswordForm">
                    <div class="form-group"><label>Current Password</label><input type="password" id="currentPass" required /></div>
                    <div class="form-group"><label>New Password</label><input type="password" id="newPass" required /></div>
                    <div class="form-group"><label>Confirm</label><input type="password" id="confirmPass" required /></div>
                    <button type="submit" class="btn btn-gold">Update</button>
                </form>
            </div>
            <div class="card mt-16">
                <h4 style="color:#ffd700;">Active Sessions</h4>
                <p class="text-muted">${navigator.userAgent}</p>
                <button class="btn btn-danger" onclick="if(confirm('Sign out all other sessions?')){UI.showToast('All sessions logged out.', 'success'); AuthService._audit('ALL_SESSIONS_LOGOUT', 'User ${user.email} logged out all sessions', ${user.id});}">Sign Out All</button>
            </div>
        `;
        document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const current = document.getElementById('currentPass').value;
            const newP = document.getElementById('newPass').value;
            const confirm = document.getElementById('confirmPass').value;
            if (current !== user.password) return UI.showToast('Current password incorrect.', 'error');
            if (newP !== confirm || newP.length < 4) return UI.showToast('Passwords must match and be at least 4 characters.', 'error');
            try {
                UserService.updateUser(user.id, { password: newP });
                UI.showToast('Password updated!', 'success');
                renderSecurity();
                AuthService._audit('PASSWORD_CHANGED', `User ${user.email} changed password`, user.id);
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    // ---- Profile ----
    function renderProfile() {
        main.innerHTML = `
            <h2>👤 Profile</h2>
            <div class="card">
                <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
                    <div style="width:80px;height:80px;border-radius:50%;background:#2a2a5a;overflow:hidden;">
                        ${user.avatar ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;" />` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:36px;">👤</div>`}
                    </div>
                    <div>
                        <label style="color:#a7a9be;font-size:12px;">Upload Avatar</label>
                        <input type="file" id="avatarUpload" accept="image/*" style="display:block;margin-top:4px;" />
                    </div>
                </div>
                <div class="form-group"><label>First Name</label><input type="text" id="profFirst" value="${user.firstName}" /></div>
                <div class="form-group"><label>Last Name</label><input type="text" id="profLast" value="${user.lastName}" /></div>
                <div class="form-group"><label>Email</label><input type="email" value="${user.email}" disabled style="opacity:0.6;" /></div>
                <div class="form-group"><label>Phone</label><input type="text" id="profPhone" value="${user.phone || ''}" /></div>
                <div class="form-group"><label>Address</label><input type="text" id="profAddress" value="${user.address || ''}" /></div>
                <div class="form-group"><label>Bio</label><textarea id="profBio">${user.bio || ''}</textarea></div>
                <button class="btn btn-gold" id="updateProfileBtn">Update Profile</button>
            </div>
        `;
        document.getElementById('avatarUpload').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const avatar = ev.target.result;
                    try {
                        UserService.updateUser(user.id, { avatar });
                        UI.showToast('Avatar updated!', 'success');
                        renderProfile();
                        AuthService._audit('AVATAR_UPDATED', `User ${user.email} updated avatar`, user.id);
                    } catch (err) {
                        UI.showToast(err.message, 'error');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
        document.getElementById('updateProfileBtn').addEventListener('click', function() {
            const firstName = document.getElementById('profFirst').value;
            const lastName = document.getElementById('profLast').value;
            const phone = document.getElementById('profPhone').value;
            const address = document.getElementById('profAddress').value;
            const bio = document.getElementById('profBio').value;
            try {
                UserService.updateUser(user.id, { firstName, lastName, phone, address, bio });
                UI.showToast('Profile updated!', 'success');
                // Update current user object
                Object.assign(user, { firstName, lastName, phone, address, bio });
                AppState.set('user', user);
                renderProfile();
                AuthService._audit('PROFILE_UPDATED', `User ${user.email} updated profile`, user.id);
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    // ---- Settings ----
    function renderSettings() {
        const currency = DataService.getCurrency();
        main.innerHTML = `
            <h2>⚙️ Settings</h2>
            <div class="card">
                <h4 style="color:#ffd700;">Currency</h4>
                <select id="currencySelect">
                    ${APP_CONFIG.CURRENCIES.map(c => `<option value="${c}" ${c===currency?'selected':''}>${c}</option>`).join('')}
                </select>
                <button class="btn btn-secondary mt-8" onclick="updateCurrency()">Update</button>
            </div>
            <div class="card mt-16">
                <h4 style="color:#ffd700;">Two-Factor Authentication</h4>
                ${user.mfa_enabled ? 
                    `<p class="text-success">✅ MFA is enabled.</p>
                    <button class="btn btn-danger" onclick="disableMFA()">Disable MFA</button>` :
                    `<p class="text-muted">MFA is not enabled.</p>
                    <button class="btn btn-gold" onclick="enableMFA()">Enable MFA</button>`
                }
            </div>
        `;
    }

    window.updateCurrency = function() {
        const newCurrency = document.getElementById('currencySelect').value;
        DataService.setCurrency(newCurrency);
        UI.showToast(`Currency updated to ${newCurrency}`, 'success');
        renderSettings();
        AuthService._audit('CURRENCY_CHANGED', `User ${user.email} changed currency to ${newCurrency}`, user.id);
    };

    window.enableMFA = function() {
        const secret = Math.random().toString(36).slice(2,8).toUpperCase();
        try {
            UserService.updateUser(user.id, { mfa_enabled: true, mfa_secret: secret });
            UI.showToast(`MFA enabled! Use code: ${secret}`, 'success');
            renderSettings();
            AuthService._audit('MFA_ENABLED', `User ${user.email} enabled MFA`, user.id);
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    };

    window.disableMFA = function() {
        if (!confirm('Disable MFA?')) return;
        try {
            UserService.updateUser(user.id, { mfa_enabled: false, mfa_secret: null });
            UI.showToast('MFA disabled.', 'success');
            renderSettings();
            AuthService._audit('MFA_DISABLED', `User ${user.email} disabled MFA`, user.id);
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    };

    // ---- Mark All Read ----
    window.markAllRead = function() {
        const notifs = DataService.getNotifications();
        const updated = notifs.map(n => {
            if (n.userId === user.id) n.isRead = true;
            return n;
        });
        DataService.setNotifications(updated);
        UI.showToast('All notifications marked as read.', 'success');
        renderDashboard();
        AuthService._audit('NOTIFICATIONS_MARKED_READ', `User ${user.email} marked all read`, user.id);
    };

    // ---- Push Notifications ----
    window.askNotificationPermission = function() {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            return UI.showToast('Push not supported in this browser.', 'error');
        }
        if (Notification.permission === 'granted') {
            return UI.showToast('Push already enabled.', 'success');
        }
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
                UI.showToast('Push notifications enabled.', 'success');
                AuthService._audit('PUSH_ENABLED', `User ${user.email} enabled push`, user.id);
            } else {
                UI.showToast('Push denied.', 'warning');
            }
        });
    };

    // ---- Helper: Get next funding date ----
    function getNextFundingDate() {
        const now = new Date();
        const day = now.getDay();
        const daysUntilFriday = (5 - day + 7) % 7 || 7;
        const next = new Date(now);
        next.setDate(now.getDate() + daysUntilFriday);
        next.setHours(0,0,0,0);
        return next;
    }

    // ---- Hash change ----
    window.addEventListener('hashchange', render);
    window.addEventListener('load', render);
})();
