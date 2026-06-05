const NexusApp = (function() {

    // ======================== CONSTANTS ========================
    const STORAGE_KEY = 'nexus_db';
    const ADMIN_KEY = 'nexus_admin';
    const SESSION_KEY = 'nexus_admin_session';
    const SESSION_TIMEOUT_KEY = 'nexus_session_expiry';
    const PRICING_KEY = 'nexus_pricing';
    const ENT_PRICING_KEY = 'nexus_enterprise_pricing';
    const SITE_KEY = 'nexus_site';
    const SESSION_DURATION_MS = 30 * 60 * 1000;

    const DEFAULT_ADMIN = { username: 'admin', password: 'admin123' };

    const DEFAULT_DB = {
        "NX-84729104": {
            tracking_id: "NX-84729104", status: "transit", service_tier: "Express Priority",
            estimated_delivery: "June 02, 2026 by 6:00 PM", route: "JFK → LAX",
            origin: "New York, NY", destination: "Los Angeles, CA", weight: 3.2,
            history: {
                created:  { time: "May 28 • 10:00 AM", desc: "Sender generated package metadata and delivery sheets." },
                pickup:   { time: "May 29 • 2:30 PM",  desc: "Package physically collected and processed at New York Sortation Facility." },
                transit:  { time: "May 30 • 9:15 AM",  desc: "Dispatched via regional freight network toward destination depot." },
                delivered:{ time: null,                 desc: "Out for distribution with local courier team." }
            }
        },
        "NX-10293847": {
            tracking_id: "NX-10293847", status: "pickup", service_tier: "Standard Flow",
            estimated_delivery: "June 05, 2026", route: "ORD → SFO",
            origin: "Chicago, IL", destination: "San Francisco, CA", weight: 1.8,
            history: {
                created:  { time: "June 01 • 9:00 AM", desc: "Label created, awaiting courier pickup." },
                pickup:   { time: null,                 desc: "Scheduled pickup window: 2-4 PM." },
                transit:  { time: null,                 desc: "Waiting for pickup confirmation." },
                delivered:{ time: null,                 desc: "Not yet dispatched." }
            }
        },
        "NX-55918372": {
            tracking_id: "NX-55918372", status: "delivered", service_tier: "Express Priority",
            estimated_delivery: "May 30, 2026 by 10:00 AM", route: "MIA → ATL",
            origin: "Miami, FL", destination: "Atlanta, GA", weight: 0.9,
            history: {
                created:  { time: "May 27 • 8:30 AM",  desc: "Label created for express shipment." },
                pickup:   { time: "May 27 • 3:15 PM",  desc: "Picked up from Miami fulfillment center." },
                transit:  { time: "May 28 • 11:00 PM", desc: "In transit to Atlanta hub." },
                delivered:{ time: "May 30 • 9:45 AM",  desc: "Delivered and signed for by recipient." }
            }
        },
        "NX-77442091": {
            tracking_id: "NX-77442091", status: "created", service_tier: "Standard Flow",
            estimated_delivery: "June 10, 2026", route: "SEA → DEN",
            origin: "Seattle, WA", destination: "Denver, CO", weight: 5.0,
            history: {
                created:  { time: "June 04 • 7:00 AM",  desc: "Label generated, awaiting pickup scheduling." },
                pickup:   { time: null, desc: "Pickup window not yet confirmed." },
                transit:  { time: null, desc: "Awaiting pickup." },
                delivered:{ time: null, desc: "Not yet dispatched." }
            }
        },
        "NX-33668815": {
            tracking_id: "NX-33668815", status: "transit", service_tier: "Express Priority",
            estimated_delivery: "June 06, 2026 by 12:00 PM", route: "DFW → JFK",
            origin: "Dallas, TX", destination: "New York, NY", weight: 2.1,
            history: {
                created:  { time: "June 03 • 1:00 PM",  desc: "Rush order processed." },
                pickup:   { time: "June 03 • 6:30 PM",  desc: "Picked up from Dallas depot." },
                transit:  { time: "June 04 • 4:00 AM",  desc: "En route to JFK via express air freight." },
                delivered:{ time: null,                  desc: "Expected delivery within window." }
            }
        }
    };

    const DEFAULT_SITE = { companyName: 'NEXUS', footerText: '\u00a9 2026 Nexus Logistics Inc. Built with modern UI frameworks.' };
    const DEFAULT_PRICING = { baseEconomy: 10, baseStandard: 25, baseExpress: 60, weightMultiplier: 5.50 };
    const DEFAULT_ENT_PRICING = {
        airBase: 80, airPerKg: 12.0,
        oceanBase: 150, oceanPerKg: 3.5,
        groundBase: 20, groundPerKg: 4.0
    };

    const STATUS_ORDER = ['created', 'pickup', 'transit', 'delivered'];

    // ======================== STATE ========================
    let mockDatabase = {};
    let adminCredentials = {};
    let siteSettings = {};
    let pricingConfig = {};
    let enterprisePricing = {};

    // ======================== STORAGE HELPERS ========================
    function loadJSON(key, fallback) {
        const raw = localStorage.getItem(key);
        if (raw) { try { return JSON.parse(raw); } catch(e) {} }
        return fallback ? JSON.parse(JSON.stringify(fallback)) : null;
    }
    function saveJSON(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

    function initData() {
        mockDatabase = loadJSON(STORAGE_KEY, DEFAULT_DB);
        adminCredentials = loadJSON(ADMIN_KEY, DEFAULT_ADMIN);
        siteSettings = loadJSON(SITE_KEY, DEFAULT_SITE);
        pricingConfig = loadJSON(PRICING_KEY, DEFAULT_PRICING);
        enterprisePricing = loadJSON(ENT_PRICING_KEY, DEFAULT_ENT_PRICING);
        applySiteSettings(siteSettings);
    }

    function saveDB() { saveJSON(STORAGE_KEY, mockDatabase); }
    function saveAdmin() { saveJSON(ADMIN_KEY, adminCredentials); }
    function saveSite() { saveJSON(SITE_KEY, siteSettings); applySiteSettings(siteSettings); }
    function savePricing() { saveJSON(PRICING_KEY, pricingConfig); }
    function saveEnterprisePricing() { saveJSON(ENT_PRICING_KEY, enterprisePricing); }

    // ======================== SITE SETTINGS ========================
    function applySiteSettings(site) {
        const nameEl = document.getElementById('company-name');
        if (nameEl) nameEl.innerHTML = `${site.companyName}<span class="text-blue-600">.</span>`;
        const footerEl = document.getElementById('footer-text');
        if (footerEl) footerEl.innerText = site.footerText;
    }

    // ======================== SESSION MANAGEMENT ========================
    function isAdminSessionActive() {
        const expiry = sessionStorage.getItem(SESSION_TIMEOUT_KEY);
        if (!expiry) return false;
        if (Date.now() > parseInt(expiry, 10)) {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_TIMEOUT_KEY);
            return false;
        }
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    }

    function setAdminSession(active) {
        if (active) {
            sessionStorage.setItem(SESSION_KEY, 'true');
            sessionStorage.setItem(SESSION_TIMEOUT_KEY, String(Date.now() + SESSION_DURATION_MS));
        } else {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(SESSION_TIMEOUT_KEY);
        }
    }

    // ======================== UI UTILITIES ========================
    function toggleMobileMenu() {
        const menu = document.getElementById('mobile-menu');
        const btn = document.querySelector('[aria-label="Toggle menu"]');
        if (!menu || !btn) return;
        const isHidden = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !isHidden);
        btn.setAttribute('aria-expanded', String(isHidden));
    }

    function getEl(id) { return document.getElementById(id); }

    function showToast(msg) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl transform translate-y-10 opacity-0 transition-all duration-300 pointer-events-auto max-w-xs';
        toast.innerText = msg;
        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        });
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // ======================== PUBLIC MODAL ========================
    function openModal(title, html) {
        getEl('modal-title').innerText = title;
        getEl('modal-body').innerHTML = html;
        const modal = getEl('global-modal');
        const content = getEl('modal-content-container');
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.setAttribute('aria-hidden', 'false');
        content.classList.remove('scale-95');
    }

    function closeModal() {
        const modal = getEl('global-modal');
        const content = getEl('modal-content-container');
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.setAttribute('aria-hidden', 'true');
        content.classList.add('scale-95');
    }

    function openLoginModal() {
        openModal('Access Portal',
            `<form id="login-form" class="space-y-4" onsubmit="event.preventDefault(); NexusApp.closeModal(); NexusApp.showToast('Logged in successfully!');">
                <p class="text-sm text-slate-500 mb-4 font-medium">Sign in to manage your shipments and enterprise tools.</p>
                <input type="email" placeholder="Email Address" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/8 text-sm font-semibold bg-slate-50/50 transition-all" required />
                <input type="password" placeholder="Password" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/8 text-sm font-semibold bg-slate-50/50 transition-all" required />
                <button type="submit" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md mt-2 tracking-wide">Sign In</button>
                <p class="text-xs text-center text-slate-400 mt-4 cursor-pointer hover:text-slate-600 font-medium" onclick="event.stopPropagation(); NexusApp.showToast('Password reset link sent.')">Forgot your password?</p>
            </form>`
        );
    }

    // ======================== ADMIN MODAL ========================
    function openAdminModal(title, html) {
        getEl('admin-modal-title').innerText = title;
        getEl('admin-body').innerHTML = html;
        const modal = getEl('admin-modal');
        const content = getEl('admin-content-container');
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.setAttribute('aria-hidden', 'false');
        content.classList.remove('scale-95');
    }

    function closeAdminModal() {
        const modal = getEl('admin-modal');
        const content = getEl('admin-content-container');
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.setAttribute('aria-hidden', 'true');
        content.classList.add('scale-95');
    }

    function openAdminEntry() {
        if (isAdminSessionActive()) {
            if (sessionStorage.getItem(SESSION_TIMEOUT_KEY)) {
                const remaining = parseInt(sessionStorage.getItem(SESSION_TIMEOUT_KEY), 10) - Date.now();
                if (remaining < 60000) {
                    setAdminSession(true);
                }
            }
            showAdminDashboard();
        } else {
            openAdminLogin();
        }
    }

    function openAdminLogin() {
        const content = `<form id="admin-login-form" class="space-y-4" onsubmit="event.preventDefault(); NexusApp.adminLogin();">
            <p class="text-sm text-slate-500 mb-4 font-medium">Administrator authentication required.</p>
            <input type="text" id="admin-username" placeholder="Username" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/8 text-sm font-semibold bg-slate-50/50 transition-all" required />
            <input type="password" id="admin-password" placeholder="Password" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/8 text-sm font-semibold bg-slate-50/50 transition-all" required />
            <p id="admin-login-error" class="text-red-500 text-xs font-semibold hidden">Invalid credentials. Default: admin / admin123</p>
            <button type="submit" class="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md mt-2 tracking-wide">Login</button>
        </form>`;
        openAdminModal('Admin Login', content);
    }

    function adminLogin() {
        const username = getEl('admin-username').value.trim();
        const password = getEl('admin-password').value;
        if (username === adminCredentials.username && password === adminCredentials.password) {
            getEl('admin-login-error').classList.add('hidden');
            setAdminSession(true);
            showAdminDashboard();
        } else {
            getEl('admin-login-error').classList.remove('hidden');
        }
    }

    function adminLogout() {
        setAdminSession(false);
        closeAdminModal();
        showToast('Admin session ended.');
    }

    // ======================== ADMIN DASHBOARD ========================
    function showAdminDashboard() {
        const html = `
            <div class="space-y-8">
                <div class="flex justify-between items-center bg-slate-50 rounded-2xl px-5 py-3 border border-slate-200">
                    <div class="flex items-center gap-2.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span class="text-xs font-semibold text-slate-600">Admin session active</span>
                    </div>
                    <button onclick="NexusApp.adminLogout()" class="text-xs font-bold text-red-500 hover:text-red-700 bg-white px-4 py-2 rounded-lg border border-red-200 hover:border-red-300 transition-all">Logout</button>
                </div>
                <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                    <button onclick="NexusApp.switchAdminTab('parcels')" class="admin-tab px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-900 transition-all" data-tab="parcels">Parcels</button>
                    <button onclick="NexusApp.switchAdminTab('add')" class="admin-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all" data-tab="add">Add Parcel</button>
                    <button onclick="NexusApp.switchAdminTab('pricing')" class="admin-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all" data-tab="pricing">Public Pricing</button>
                    <button onclick="NexusApp.switchAdminTab('settings')" class="admin-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all" data-tab="settings">Site Settings</button>
                    <button onclick="NexusApp.switchAdminTab('password')" class="admin-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all" data-tab="password">Change Password</button>
                </div>
                <div id="admin-tab-parcels" class="admin-tab-content">${renderParcelsTable()}</div>
                <div id="admin-tab-add" class="admin-tab-content hidden">${renderAddParcelForm()}</div>
                <div id="admin-tab-pricing" class="admin-tab-content hidden">${renderPublicPricingSettings()}</div>
                <div id="admin-tab-settings" class="admin-tab-content hidden">${renderSiteSettings()}</div>
                <div id="admin-tab-password" class="admin-tab-content hidden">${renderChangePassword()}</div>
            </div>`;
        openAdminModal('Admin Dashboard', html);
    }

    function switchAdminTab(tab) {
        document.querySelectorAll('.admin-tab').forEach(b => {
            if (b.dataset.tab === tab) {
                b.classList.add('bg-slate-100', 'text-slate-900');
                b.classList.remove('text-slate-600');
            } else {
                b.classList.remove('bg-slate-100', 'text-slate-900');
                b.classList.add('text-slate-600');
            }
        });
        document.querySelectorAll('.admin-tab-content').forEach(d => d.classList.add('hidden'));
        const target = getEl(`admin-tab-${tab}`);
        if (target) target.classList.remove('hidden');
    }

    function renderParcelsTable() {
        const ids = Object.keys(mockDatabase);
        let rows = '';
        for (const id of ids) {
            const p = mockDatabase[id];
            rows += `<tr class="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td class="py-3 px-3 text-sm font-mono font-semibold">${escHtml(p.tracking_id)}</td>
                <td class="py-3 px-3 text-sm font-semibold capitalize">
                    <span class="${STATUS_BADGE[p.status] || 'text-slate-500'}">${p.status}</span>
                </td>
                <td class="py-3 px-3 text-sm">${escHtml(p.origin || '-')} → ${escHtml(p.destination || '-')}</td>
                <td class="py-3 px-3 text-sm">${p.weight ? p.weight + ' kg' : '-'}</td>
                <td class="py-3 px-3 text-sm">
                    <button onclick="NexusApp.editParcel('${p.tracking_id}')" class="text-blue-600 hover:text-blue-800 font-semibold mr-3 transition-colors">Edit</button>
                    <button onclick="NexusApp.deleteParcel('${p.tracking_id}')" class="text-red-500 hover:text-red-700 font-semibold transition-colors">Delete</button>
                </td>
            </tr>`;
        }
        return `
            <div class="flex items-center justify-between mb-4">
                <h3 class="font-extrabold text-lg">All Parcels <span class="text-slate-400 font-medium">(${ids.length})</span></h3>
                <button onclick="NexusApp.switchAdminTab('add')" class="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all">+ Add New</button>
            </div>
            <div class="overflow-x-auto rounded-xl border border-slate-200">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500 font-bold">
                            <th class="py-3 px-3">ID</th>
                            <th class="py-3 px-3">Status</th>
                            <th class="py-3 px-3">Route</th>
                            <th class="py-3 px-3">Weight</th>
                            <th class="py-3 px-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="5" class="py-10 text-center text-slate-400 font-medium">No parcels found. Click "Add New" to create one.</td></tr>'}</tbody>
                </table>
            </div>`;
    }

    const STATUS_BADGE = {
        created: 'text-slate-500',
        pickup: 'text-amber-600',
        transit: 'text-blue-600',
        delivered: 'text-emerald-600'
    };

    function escHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function editParcel(id) {
        const p = mockDatabase[id];
        if (!p) return;
        const html = `
            <h3 class="font-extrabold text-lg mb-5">Edit Parcel: <span class="font-mono text-blue-600">${escHtml(id)}</span></h3>
            <form onsubmit="event.preventDefault(); NexusApp.saveParcelEdit('${id}')" class="space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[11px] font-bold uppercase tracking-widest text-slate-500">Origin</label>
                        <input id="edit-origin" value="${escHtml(p.origin || '')}" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50/50 focus:outline-none focus:border-blue-400 transition-all" /></div>
                    <div><label class="text-[11px] font-bold uppercase tracking-widest text-slate-500">Destination</label>
                        <input id="edit-dest" value="${escHtml(p.destination || '')}" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50/50 focus:outline-none focus:border-blue-400 transition-all" /></div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div><label class="text-[11px] font-bold uppercase tracking-widest text-slate-500">Status</label>
                        <select id="edit-status" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50/50 focus:outline-none focus:border-blue-400 transition-all">
                            ${STATUS_ORDER.map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                        </select></div>
                    <div><label class="text-[11px] font-bold uppercase tracking-widest text-slate-500">Weight (kg)</label>
                        <input id="edit-weight" type="number" step="0.1" min="0" value="${p.weight || ''}" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50/50 focus:outline-none focus:border-blue-400 transition-all" /></div>
                    <div><label class="text-[11px] font-bold uppercase tracking-widest text-slate-500">Route</label>
                        <input id="edit-route" value="${escHtml(p.route || '')}" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50/50 focus:outline-none focus:border-blue-400 transition-all" /></div>
                </div>
                <div><label class="text-[11px] font-bold uppercase tracking-widest text-slate-500">Estimated Delivery</label>
                    <input id="edit-eta" value="${escHtml(p.estimated_delivery || '')}" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50/50 focus:outline-none focus:border-blue-400 transition-all" /></div>
                <div><label class="text-[11px] font-bold uppercase tracking-widest text-slate-500">Service Tier</label>
                    <input id="edit-tier" value="${escHtml(p.service_tier || '')}" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-slate-50/50 focus:outline-none focus:border-blue-400 transition-all" /></div>
                <div class="border-t pt-5">
                    <h4 class="font-bold text-sm mb-3 text-slate-700">History</h4>
                    ${STATUS_ORDER.map(step => {
                        const h = p.history[step] || { time: '', desc: '' };
                        return `<div class="grid grid-cols-5 gap-2 mb-2 items-center text-xs">
                            <span class="font-semibold capitalize text-slate-600">${step}:</span>
                            <input id="edit-time-${step}" value="${escHtml(h.time || '')}" placeholder="Time" class="col-span-2 px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 text-xs focus:outline-none focus:border-blue-400 transition-all" />
                            <input id="edit-desc-${step}" value="${escHtml(h.desc || '')}" placeholder="Description" class="col-span-2 px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50 text-xs focus:outline-none focus:border-blue-400 transition-all" />
                        </div>`;
                    }).join('')}
                </div>
                <div class="flex gap-3 justify-end pt-4 border-t">
                    <button type="button" onclick="NexusApp.showAdminDashboard()" class="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">Cancel</button>
                    <button type="submit" class="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm">Save Changes</button>
                </div>
            </form>`;
        openAdminModal('Edit Parcel', html);
    }

    function saveParcelEdit(id) {
        const p = mockDatabase[id];
        if (!p) return;
        p.origin = getEl('edit-origin').value;
        p.destination = getEl('edit-dest').value;
        p.status = getEl('edit-status').value;
        p.weight = parseFloat(getEl('edit-weight').value) || 0;
        p.route = getEl('edit-route').value;
        p.estimated_delivery = getEl('edit-eta').value;
        p.service_tier = getEl('edit-tier').value;
        STATUS_ORDER.forEach(step => {
            p.history[step] = {
                time: getEl(`edit-time-${step}`).value,
                desc: getEl(`edit-desc-${step}`).value
            };
        });
        saveDB();
        showToast('Parcel updated successfully');
        showAdminDashboard();
    }

    function deleteParcel(id) {
        showConfirmModal(
            `Delete Parcel ${id}?`,
            `This will permanently remove tracking data for <strong>${escHtml(id)}</strong>. This action cannot be undone.`,
            () => {
                delete mockDatabase[id];
                saveDB();
                showToast('Parcel deleted');
                showAdminDashboard();
            }
        );
    }

    function showConfirmModal(title, message, onConfirm) {
        openModal(title, `
            <div class="space-y-5">
                <p class="text-sm text-slate-600">${message}</p>
                <div class="flex gap-3 justify-end pt-2">
                    <button onclick="NexusApp.closeModal()" class="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">Cancel</button>
                    <button onclick="NexusApp.closeModal(); (${onConfirm.toString()})()" class="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all shadow-sm">Delete</button>
                </div>
            </div>
        `);
    }

    function renderAddParcelForm() {
        return `
            <h3 class="font-extrabold text-lg mb-5">Add New Parcel</h3>
            <form onsubmit="event.preventDefault(); NexusApp.addParcel()" class="space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[11px] font-bold uppercase">Tracking ID <span class="text-red-500">*</span></label>
                        <input id="add-id" required pattern="^NX-[0-9]{8}$" placeholder="NX-XXXXXXXX" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Status</label>
                        <select id="add-status" class="w-full px-3 py-2.5 border rounded-xl text-sm">
                            ${STATUS_ORDER.map(s => `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                        </select></div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div><label class="text-[11px] font-bold uppercase">Origin</label>
                        <input id="add-origin" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Destination</label>
                        <input id="add-dest" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Weight (kg)</label>
                        <input id="add-weight" type="number" step="0.1" min="0.1" value="1.0" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[11px] font-bold uppercase">Route</label>
                        <input id="add-route" placeholder="e.g. JFK → LAX" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Service Tier</label>
                        <input id="add-tier" value="Standard" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                </div>
                <div><label class="text-[11px] font-bold uppercase">Est. Delivery</label>
                    <input id="add-eta" placeholder="e.g. June 10, 2026" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                <div class="border-t pt-4">
                    <h4 class="font-bold text-sm mb-3">History</h4>
                    ${STATUS_ORDER.map(step => `
                        <div class="grid grid-cols-5 gap-2 mb-2 items-center text-xs">
                            <span class="font-semibold capitalize">${step}:</span>
                            <input id="add-time-${step}" placeholder="Time" class="col-span-2 px-2 py-1.5 border rounded-lg text-xs" />
                            <input id="add-desc-${step}" placeholder="Description" class="col-span-2 px-2 py-1.5 border rounded-lg text-xs" />
                        </div>`).join('')}
                </div>
                <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm">Add Parcel</button>
            </form>`;
    }

    function addParcel() {
        const id = getEl('add-id').value.trim();
        if (!id) { showToast('Tracking ID is required'); return; }
        if (!/^NX-[0-9]{8}$/.test(id)) { showToast('ID must follow format NX-XXXXXXXX (8 digits)'); return; }
        if (mockDatabase[id]) { showToast('A parcel with this ID already exists'); return; }
        const p = {
            tracking_id: id,
            status: getEl('add-status').value,
            origin: getEl('add-origin').value,
            destination: getEl('add-dest').value,
            weight: parseFloat(getEl('add-weight').value) || 0,
            route: getEl('add-route').value,
            service_tier: getEl('add-tier').value,
            estimated_delivery: getEl('add-eta').value,
            history: {}
        };
        STATUS_ORDER.forEach(step => {
            p.history[step] = {
                time: getEl(`add-time-${step}`).value,
                desc: getEl(`add-desc-${step}`).value
            };
        });
        mockDatabase[id] = p;
        saveDB();
        showToast('Parcel added successfully');
        showAdminDashboard();
    }

    function renderSiteSettings() {
        return `
            <h3 class="font-extrabold text-lg mb-5">Site Settings</h3>
            <form onsubmit="event.preventDefault(); NexusApp.saveSiteSettings()" class="space-y-5">
                <div><label class="text-[11px] font-bold uppercase">Company Name</label>
                    <input id="site-company" value="${escHtml(siteSettings.companyName)}" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                <div><label class="text-[11px] font-bold uppercase">Footer Text</label>
                    <input id="site-footer" value="${escHtml(siteSettings.footerText)}" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm">Save Settings</button>
            </form>`;
    }

    function saveSiteSettings() {
        siteSettings.companyName = getEl('site-company').value;
        siteSettings.footerText = getEl('site-footer').value;
        saveSite();
        showToast('Site settings updated');
        showAdminDashboard();
    }

    function renderChangePassword() {
        return `
            <h3 class="font-extrabold text-lg mb-5">Change Admin Password</h3>
            <form onsubmit="event.preventDefault(); NexusApp.changeAdminPassword()" class="space-y-5">
                <div><label class="text-[11px] font-bold uppercase">Current Password</label>
                    <input id="old-password" type="password" required class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                <div><label class="text-[11px] font-bold uppercase">New Password <span class="text-slate-400 font-normal lowercase">(min 6 chars)</span></label>
                    <input id="new-password" type="password" required minlength="6" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                <p id="pwd-error" class="text-red-500 text-xs font-semibold hidden">Incorrect current password.</p>
                <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm">Update Password</button>
            </form>`;
    }

    function changeAdminPassword() {
        const old = getEl('old-password').value;
        if (old !== adminCredentials.password) {
            getEl('pwd-error').classList.remove('hidden');
            return;
        }
        const newPwd = getEl('new-password').value;
        if (newPwd.length < 6) { showToast('Password must be at least 6 characters'); return; }
        adminCredentials.password = newPwd;
        saveAdmin();
        setAdminSession(true);
        showToast('Password updated successfully');
        showAdminDashboard();
    }

    function renderPublicPricingSettings() {
        const p = pricingConfig;
        return `
            <h3 class="font-extrabold text-lg mb-5">Public Rate Calculator Pricing</h3>
            <form onsubmit="event.preventDefault(); NexusApp.savePublicPricing()" class="space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[11px] font-bold uppercase">Economy Base ($)</label>
                        <input id="pricing-economy" type="number" step="0.01" min="0" value="${p.baseEconomy}" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Standard Base ($)</label>
                        <input id="pricing-standard" type="number" step="0.01" min="0" value="${p.baseStandard}" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[11px] font-bold uppercase">Express Base ($)</label>
                        <input id="pricing-express" type="number" step="0.01" min="0" value="${p.baseExpress}" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Weight Multiplier ($/kg)</label>
                        <input id="pricing-multiplier" type="number" step="0.01" min="0" value="${p.weightMultiplier}" class="w-full px-3 py-2.5 border rounded-xl text-sm" /></div>
                </div>
                <p class="text-xs text-slate-500">Formula: <strong>Total = Base + (Weight &times; Multiplier)</strong></p>
                <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm">Save Pricing</button>
            </form>`;
    }

    function savePublicPricing() {
        pricingConfig = {
            baseEconomy: parseFloat(getEl('pricing-economy').value) || 0,
            baseStandard: parseFloat(getEl('pricing-standard').value) || 0,
            baseExpress: parseFloat(getEl('pricing-express').value) || 0,
            weightMultiplier: parseFloat(getEl('pricing-multiplier').value) || 0
        };
        savePricing();
        calculateRates();
        showToast('Public pricing updated');
        showAdminDashboard();
    }

    // ======================== ENTERPRISE PORTAL ========================
    function openEnterpriseDashboard() {
        const html = `
            <div class="space-y-8">
                <div class="flex items-center gap-2.5 bg-blue-50 rounded-2xl px-5 py-3 border border-blue-100">
                    <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <span class="text-xs font-semibold text-blue-800">Enterprise Portal &ndash; Open Access</span>
                </div>
                <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                    <button onclick="NexusApp.switchEntTab('analytics')" class="ent-tab px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 text-slate-900 transition-all" data-tab="analytics">Analytics</button>
                    <button onclick="NexusApp.switchEntTab('api')" class="ent-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all" data-tab="api">API &amp; Integration</button>
                    <button onclick="NexusApp.switchEntTab('multimodal')" class="ent-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all" data-tab="multimodal">Shipping Rates</button>
                </div>
                <div id="ent-tab-analytics" class="ent-tab-content">${renderEnterpriseAnalytics()}</div>
                <div id="ent-tab-api" class="ent-tab-content hidden">${renderEnterpriseApi()}</div>
                <div id="ent-tab-multimodal" class="ent-tab-content hidden">${renderEnterprisePricing()}</div>
            </div>`;
        openEnterpriseModal('Enterprise Dashboard', html);
    }

    function switchEntTab(tab) {
        document.querySelectorAll('.ent-tab').forEach(b => {
            if (b.dataset.tab === tab) {
                b.classList.add('bg-slate-100', 'text-slate-900');
                b.classList.remove('text-slate-600');
            } else {
                b.classList.remove('bg-slate-100', 'text-slate-900');
                b.classList.add('text-slate-600');
            }
        });
        document.querySelectorAll('.ent-tab-content').forEach(d => d.classList.add('hidden'));
        const target = getEl(`ent-tab-${tab}`);
        if (target) target.classList.remove('hidden');
    }

    function renderEnterpriseAnalytics() {
        const parcels = Object.values(mockDatabase);
        const total = parcels.length;
        const statusCount = { created: 0, pickup: 0, transit: 0, delivered: 0 };
        parcels.forEach(p => { if (statusCount[p.status] !== undefined) statusCount[p.status]++; });
        const avgWeight = total ? (parcels.reduce((a, p) => a + (p.weight || 0), 0) / total).toFixed(1) : '0';
        return `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                    <p class="text-xs font-bold uppercase text-slate-500">Total Shipments</p>
                    <p class="text-3xl font-extrabold text-slate-900 mt-1">${total}</p>
                </div>
                <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                    <p class="text-xs font-bold uppercase text-slate-500">In Transit</p>
                    <p class="text-3xl font-extrabold text-amber-500 mt-1">${statusCount.transit}</p>
                </div>
                <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                    <p class="text-xs font-bold uppercase text-slate-500">Delivered</p>
                    <p class="text-3xl font-extrabold text-emerald-500 mt-1">${statusCount.delivered}</p>
                </div>
                <div class="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                    <p class="text-xs font-bold uppercase text-slate-500">Avg Weight</p>
                    <p class="text-3xl font-extrabold text-blue-600 mt-1">${avgWeight} kg</p>
                </div>
            </div>
            <div class="bg-white border border-slate-200 rounded-2xl p-5">
                <h4 class="font-bold text-sm mb-3">Status Distribution</h4>
                <div class="space-y-2">
                    ${STATUS_ORDER.map(s => {
                        const pct = total ? (statusCount[s] / total * 100) : 0;
                        return `<div class="flex items-center gap-3">
                            <span class="w-20 text-xs font-semibold capitalize">${s}</span>
                            <div class="flex-1 bg-slate-100 rounded-full h-3">
                                <div class="bg-blue-600 h-3 rounded-full transition-all duration-500" style="width:${pct}%"></div>
                            </div>
                            <span class="text-xs font-bold w-6 text-right">${statusCount[s]}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
    }

    function renderEnterpriseApi() {
        return `
            <div class="space-y-6">
                <div class="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-sm">
                    <p class="text-blue-400 font-bold mb-2"># Track a shipment</p>
                    <p>GET /api/v1/track/{tracking_id}</p>
                    <p class="text-slate-400 mt-1">curl -H "Authorization: Bearer YOUR_TOKEN" https://api.nexus-logistics.com/v1/track/NX-84729104</p>
                </div>
                <div class="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-sm">
                    <p class="text-blue-400 font-bold mb-2"># Create shipment</p>
                    <p>POST /api/v1/shipments</p>
                    <p class="text-slate-400">curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"origin":"NYC","destination":"LAX","weight":2.5}' https://api.nexus-logistics.com/v1/shipments</p>
                </div>
                <div class="bg-slate-900 text-slate-100 rounded-2xl p-5 font-mono text-sm">
                    <p class="text-blue-400 font-bold mb-2"># Rate quote (multi-modal)</p>
                    <p>GET /api/v1/rates?origin=NYC&amp;destination=LAX&amp;weight=5&amp;mode=air</p>
                </div>
                <p class="text-xs text-slate-500">Full API documentation available upon enterprise agreement. Webhooks: <code>shipment.status.updated</code></p>
            </div>`;
    }

    function renderEnterprisePricing() {
        const ep = enterprisePricing;
        return `
            <h3 class="font-extrabold text-lg mb-5">Enterprise Multi-Modal Rates</h3>
            <form onsubmit="event.preventDefault(); NexusApp.saveEnterprisePricingForm()" class="space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[11px] font-bold uppercase">Air Base ($)</label>
                        <input id="ent-air-base" type="number" step="0.01" min="0" value="${ep.airBase}" class="w-full px-3 py-2 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Air $/kg</label>
                        <input id="ent-air-perkg" type="number" step="0.01" min="0" value="${ep.airPerKg}" class="w-full px-3 py-2 border rounded-xl text-sm" /></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[11px] font-bold uppercase">Ocean Base ($)</label>
                        <input id="ent-ocean-base" type="number" step="0.01" min="0" value="${ep.oceanBase}" class="w-full px-3 py-2 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Ocean $/kg</label>
                        <input id="ent-ocean-perkg" type="number" step="0.01" min="0" value="${ep.oceanPerKg}" class="w-full px-3 py-2 border rounded-xl text-sm" /></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="text-[11px] font-bold uppercase">Ground Base ($)</label>
                        <input id="ent-ground-base" type="number" step="0.01" min="0" value="${ep.groundBase}" class="w-full px-3 py-2 border rounded-xl text-sm" /></div>
                    <div><label class="text-[11px] font-bold uppercase">Ground $/kg</label>
                        <input id="ent-ground-perkg" type="number" step="0.01" min="0" value="${ep.groundPerKg}" class="w-full px-3 py-2 border rounded-xl text-sm" /></div>
                </div>
                <p class="text-xs text-slate-500">These rates apply to negotiated enterprise contracts. Not visible on public calculator.</p>
                <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm">Save Enterprise Rates</button>
            </form>`;
    }

    function saveEnterprisePricingForm() {
        enterprisePricing = {
            airBase: parseFloat(getEl('ent-air-base').value) || 0,
            airPerKg: parseFloat(getEl('ent-air-perkg').value) || 0,
            oceanBase: parseFloat(getEl('ent-ocean-base').value) || 0,
            oceanPerKg: parseFloat(getEl('ent-ocean-perkg').value) || 0,
            groundBase: parseFloat(getEl('ent-ground-base').value) || 0,
            groundPerKg: parseFloat(getEl('ent-ground-perkg').value) || 0
        };
        saveEnterprisePricing();
        showToast('Enterprise rates saved');
        openEnterpriseDashboard();
    }

    function openEnterpriseModal(title, html) {
        getEl('enterprise-modal-title').innerText = title;
        getEl('enterprise-body').innerHTML = html;
        const modal = getEl('enterprise-modal');
        const content = getEl('enterprise-content-container');
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.setAttribute('aria-hidden', 'false');
        content.classList.remove('scale-95');
    }

    function closeEnterpriseModal() {
        const modal = getEl('enterprise-modal');
        const content = getEl('enterprise-content-container');
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.setAttribute('aria-hidden', 'true');
        content.classList.add('scale-95');
    }

    // ======================== TRACKING ========================
    function handleTracking() {
        const trackingId = getEl('tracking-input').value.trim();
        const resultsEl = getEl('tracking-results');
        const errorEl = getEl('tracking-error');
        const loadingEl = getEl('tracking-loading');

        if (!trackingId) {
            errorEl.querySelector('#error-text').innerText = 'Please enter a tracking ID.';
            errorEl.classList.remove('hidden');
            resultsEl.classList.add('hidden');
            if (loadingEl) loadingEl.classList.add('hidden');
            return;
        }

        if (loadingEl) loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');
        resultsEl.classList.add('hidden');

        setTimeout(() => {
            if (loadingEl) loadingEl.classList.add('hidden');

            if (mockDatabase[trackingId]) {
                const data = mockDatabase[trackingId];
                errorEl.classList.add('hidden');
                getEl('res-id').innerText = data.tracking_id;
                getEl('res-eta').innerText = data.estimated_delivery;
                getEl('res-route').innerText = data.route;

                STATUS_ORDER.forEach(step => {
                    const dot = getEl(`dot-${step}`);
                    const core = getEl(`core-${step}`);
                    const title = getEl(`title-${step}`);
                    const desc = getEl(`desc-${step}`);
                    const timeEl = getEl(`time-${step}`);
                    dot.className = "w-7 h-7 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center z-10 ring-4 ring-white transition-all duration-500";
                    core.className = "w-2.5 h-2.5 rounded-full bg-slate-300 transition-all duration-500";
                    title.className = "font-bold text-slate-400 text-sm transition-colors duration-500";
                    desc.className = "text-xs text-slate-400 leading-relaxed transition-colors duration-500";
                    timeEl.className = "text-[11px] font-semibold text-slate-400";
                    timeEl.innerText = "\u2014";
                    dot.classList.remove('timeline-dot-active');
                });

                let active = true;
                for (const step of STATUS_ORDER) {
                    if (active) {
                        const dot = getEl(`dot-${step}`);
                        const core = getEl(`core-${step}`);
                        const title = getEl(`title-${step}`);
                        const desc = getEl(`desc-${step}`);
                        const timeEl = getEl(`time-${step}`);
                        dot.classList.remove('bg-slate-100');
                        dot.classList.add('bg-blue-50');
                        core.classList.remove('bg-slate-300');
                        core.classList.add('bg-blue-600');
                        title.className = "font-bold text-slate-900 text-sm transition-colors duration-500";
                        desc.className = "text-xs text-slate-600 leading-relaxed transition-colors duration-500";
                        timeEl.className = "text-[11px] font-bold text-blue-600";
                        timeEl.innerText = data.history[step].time || "Pending";
                        if (step === data.status) dot.classList.add('timeline-dot-active');
                    }
                    if (step === data.status || data.history[step].time === null) active = false;
                }

                resultsEl.classList.remove('hidden');
                STATUS_ORDER.forEach((s, i) => {
                    const el = getEl(`step-${s}`);
                    el.classList.remove('animate-step-in');
                    void el.offsetWidth;
                    el.classList.add('animate-step-in');
                    el.style.animationDelay = `${i * 80}ms`;
                });
                requestAnimationFrame(() => {
                    resultsEl.classList.remove('translate-y-4', 'opacity-0');
                    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });

            } else {
                resultsEl.classList.add('hidden');
                errorEl.querySelector('#error-text').innerText = 'Shipment not found. Please verify the ID format (e.g. NX-84729104).';
                errorEl.classList.remove('hidden');
            }
        }, 400);
    }

    // ======================== RATE CALCULATOR ========================
    function updateWeightDisplay() {
        getEl('weight-display').innerText = `${getEl('calc-weight').value} kg`;
        calculateRates();
    }

    function calculateRates() {
        const weight = parseFloat(getEl('calc-weight').value);
        const { baseEconomy, baseStandard, baseExpress, weightMultiplier } = pricingConfig;
        const rates = [
            { name: 'Economy Route', time: '3-5 Business Days', price: baseEconomy + (weight * weightMultiplier), popular: false },
            { name: 'Standard Flow', time: '2 Business Days', price: baseStandard + (weight * weightMultiplier), popular: true },
            { name: 'Express Priority', time: 'Next Day by 12 PM', price: baseExpress + (weight * weightMultiplier), popular: false }
        ];
        const container = getEl('rates-container');
        container.innerHTML = rates.map(r => {
            const priceStr = `$${r.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            return `<div class="bg-white border ${r.popular ? 'border-blue-400 ring-2 ring-blue-500/10 shadow-md' : 'border-slate-200/70'} p-6 rounded-3xl flex flex-col justify-between space-y-5 card-premium transition-all duration-300 relative group hover:-translate-y-0.5">
                ${r.popular ? '<span class="absolute -top-3 left-6 text-[10px] font-bold tracking-widest uppercase bg-blue-600 text-white px-3 py-1 rounded-lg shadow-md">Optimal</span>' : ''}
                <div class="space-y-1.5">
                    <h4 class="font-extrabold text-slate-900 text-base group-hover:text-blue-600 transition-colors">${r.name}</h4>
                    <p class="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${r.time}
                    </p>
                </div>
                <div class="space-y-4">
                    <div class="text-2xl font-extrabold text-slate-900 tracking-tight">${priceStr}</div>
                    <button onclick="NexusApp.handleBooking('${r.name}','${priceStr}')" class="w-full text-center py-3 text-xs font-bold rounded-xl transition-all active:scale-[0.97] tracking-wide ${r.popular ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'}">Book Routing</button>
                </div>
            </div>`;
        }).join('');
    }

    function handleBooking(tier, price) {
        const origin = getEl('calc-from').value || 'Origin';
        const dest = getEl('calc-to').value || 'Destination';
        const weight = getEl('calc-weight').value;
        openModal('Confirm Booking',
            `<div class="space-y-5">
                <div class="bg-blue-50 rounded-2xl p-5 border border-blue-100 flex justify-between items-center gap-4 flex-wrap">
                    <div>
                        <p class="text-xs font-bold text-blue-600 uppercase tracking-widest">${escHtml(tier)}</p>
                        <p class="text-sm font-semibold text-slate-700 mt-1">${escHtml(origin)} &rarr; ${escHtml(dest)}</p>
                        <p class="text-xs text-slate-500 mt-0.5">Weight: ${weight} kg</p>
                    </div>
                    <div class="text-2xl font-extrabold text-slate-900">${price}</div>
                </div>
                <div class="space-y-3">
                    <label for="booking-email" class="text-[11px] font-bold uppercase text-slate-500">Contact Email</label>
                    <input id="booking-email" type="email" placeholder="receipts@company.com" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/8 text-sm font-semibold bg-slate-50/50 transition-all" />
                </div>
                <button onclick="NexusApp.closeModal(); NexusApp.showToast('Routing booked! Label sent to email.')" class="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md tracking-wide">Confirm &amp; Generate Label</button>
            </div>`
        );
    }

    // ======================== INIT ========================
    function init() {
        initData();

        document.getElementById('tracking-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleTracking();
        });

        document.getElementById('calc-weight').addEventListener('input', updateWeightDisplay);

        document.addEventListener('click', (e) => {
            const menu = document.getElementById('mobile-menu');
            const btn = document.querySelector('[aria-label="Toggle menu"]');
            if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn) {
                menu.classList.add('hidden');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            }
        });

        window.addEventListener('scroll', () => {
            const nav = document.getElementById('main-nav');
            if (nav) nav.classList.toggle('nav-scrolled', window.scrollY > 10);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!document.getElementById('admin-modal').classList.contains('opacity-0'))
                    closeAdminModal();
                else if (!document.getElementById('enterprise-modal').classList.contains('opacity-0'))
                    closeEnterpriseModal();
                else if (!document.getElementById('global-modal').classList.contains('opacity-0'))
                    closeModal();
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                openAdminEntry();
            }
        });

        calculateRates();
    }

    return {
        init: init,
        toggleMobileMenu: toggleMobileMenu,
        showToast: showToast,
        openModal: openModal,
        closeModal: closeModal,
        openLoginModal: openLoginModal,
        openAdminEntry: openAdminEntry,
        adminLogin: adminLogin,
        adminLogout: adminLogout,
        showAdminDashboard: showAdminDashboard,
        switchAdminTab: switchAdminTab,
        editParcel: editParcel,
        saveParcelEdit: saveParcelEdit,
        deleteParcel: deleteParcel,
        addParcel: addParcel,
        saveSiteSettings: saveSiteSettings,
        changeAdminPassword: changeAdminPassword,
        savePublicPricing: savePublicPricing,
        openEnterpriseDashboard: openEnterpriseDashboard,
        switchEntTab: switchEntTab,
        saveEnterprisePricingForm: saveEnterprisePricingForm,
        closeEnterpriseModal: closeEnterpriseModal,
        closeAdminModal: closeAdminModal,
        handleTracking: handleTracking,
        handleBooking: handleBooking,
        updateWeightDisplay: updateWeightDisplay,
        calculateRates: calculateRates,
        showConfirmModal: showConfirmModal
    };

})();

document.addEventListener('DOMContentLoaded', function() {
    NexusApp.init();
});