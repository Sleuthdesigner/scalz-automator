/* =============================================
   SCALZ SEO AUTOMATOR — app.js
   Main application logic
   Connects to Supabase for all data operations
============================================= */

// In-memory store (replaces browser storage APIs unavailable in sandboxed iframes)
const _memStore = {};

/* =============================================
   A. INITIALIZATION
============================================= */

// Check if credentials are still placeholders
if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL === 'YOUR_SUPABASE_URL' ||
    typeof SUPABASE_ANON_KEY === 'undefined' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    document.getElementById('config-error-screen').style.display = 'flex';
    throw new Error('Supabase credentials not configured. See config.js');
}

// Initialize Supabase client
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App state
let currentPage = null;
let currentUser = null;
let realtimeChannel = null;
let workflowEnabledSteps = new Set(WORKFLOW_STEPS.map(s => s.id));
let clientsCache = [];
let jobsSubscription = null;

/* =============================================
   UTILITY FUNCTIONS
============================================= */

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(dateStr);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function truncate(str, len = 30) {
    if (!str) return '—';
    if (str.length <= len) return str;
    return str.slice(0, len) + '…';
}

function shortUUID(uuid) {
    if (!uuid) return '—';
    return uuid.slice(0, 8);
}

function getDuration(startStr, endStr) {
    if (!startStr) return '—';
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    const diff = Math.floor((end - start) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function getStatusBadge(status) {
    const map = {
        active:     { cls: 'badge-green',  label: 'Active' },
        onboarding: { cls: 'badge-blue',   label: 'Onboarding' },
        paused:     { cls: 'badge-amber',  label: 'Paused' },
        error:      { cls: 'badge-red',    label: 'Error' },
        pending:    { cls: 'badge-gray',   label: 'Pending' },
        queued:     { cls: 'badge-blue',   label: 'Queued' },
        running:    { cls: 'badge-amber',  label: 'Running' },
        completed:  { cls: 'badge-green',  label: 'Completed' },
        failed:     { cls: 'badge-red',    label: 'Failed' },
        cancelled:  { cls: 'badge-gray',   label: 'Cancelled' },
        used:       { cls: 'badge-green',  label: 'Used' },
        expired:    { cls: 'badge-red',    label: 'Expired' },
    };
    const s = map[status] || { cls: 'badge-gray', label: status || 'Unknown' };
    return `<span class="badge ${s.cls}">${escHtml(s.label)}</span>`;
}

function getJobIcon(status) {
    const map = {
        queued:    { cls: 'stat-icon-blue',  icon: 'fa-clock' },
        running:   { cls: 'stat-icon-amber', icon: 'fa-spinner fa-spin' },
        completed: { cls: 'stat-icon-green', icon: 'fa-check' },
        failed:    { cls: 'stat-icon-red',   icon: 'fa-xmark' },
        cancelled: { cls: 'stat-icon-blue',  icon: 'fa-ban' },
    };
    return map[status] || { cls: 'stat-icon-blue', icon: 'fa-question' };
}

/* =============================================
   B. BRANDING
============================================= */

function applyBranding() {
    const b = BRANDING;
    
    // Page title
    document.title = b.name;
    
    // Update CSS accent color
    document.documentElement.style.setProperty('--accent', b.accentColor);
    document.documentElement.style.setProperty('--accent-rgb', hexToRgb(b.accentColor));
    if (b.successColor) {
        document.documentElement.style.setProperty('--success', b.successColor);
    }
    
    // Sidebar branding
    const sidebarIcon = document.getElementById('brand-icon-sidebar');
    const sidebarLogo = document.getElementById('brand-logo-sidebar');
    const sidebarName = document.getElementById('brand-name-sidebar');
    const sidebarAccent = document.getElementById('brand-accent-sidebar');
    
    if (b.logoUrl) {
        if (sidebarIcon) sidebarIcon.classList.add('hidden');
        if (sidebarLogo) {
            sidebarLogo.src = b.logoUrl;
            sidebarLogo.classList.remove('hidden');
        }
    } else if (b.icon && sidebarIcon) {
        sidebarIcon.innerHTML = '<i class="' + b.icon + '"></i>';
    }
    
    if (sidebarName) {
        const baseText = b.name.replace(b.accentText, '');
        sidebarName.childNodes[0].textContent = baseText;
    }
    if (sidebarAccent) {
        sidebarAccent.textContent = b.accentText;
    }
    
    // Login page branding
    const loginTitle = document.getElementById('login-title');
    const loginTagline = document.getElementById('login-tagline');
    const loginIcon = document.getElementById('brand-icon-login');
    const loginLogo = document.getElementById('brand-logo-login');
    
    if (loginTitle) loginTitle.textContent = b.name;
    if (loginTagline) loginTagline.textContent = b.tagline;
    
    if (b.logoUrl) {
        if (loginIcon) loginIcon.classList.add('hidden');
        if (loginLogo) {
            loginLogo.src = b.logoUrl;
            loginLogo.classList.remove('hidden');
        }
        // Hide the text title when logo image is displayed (logo already contains brand name)
        if (loginTitle) loginTitle.style.display = 'none';
    } else if (b.icon && loginIcon) {
        loginIcon.innerHTML = '<i class="' + b.icon + '"></i>';
    }
    
    // Onboarding form branding
    const onboardName = document.getElementById('onboard-brand-name');
    const onboardAccent = document.getElementById('onboard-brand-accent');
    const onboardTitle = document.getElementById('onboard-title');
    const onboardSubtitle = document.getElementById('onboard-subtitle');
    
    if (onboardName) {
        const baseText = b.name.replace(b.accentText, '');
        onboardName.childNodes[0].textContent = baseText;
    }
    if (onboardAccent) onboardAccent.textContent = b.accentText;
    if (onboardTitle) onboardTitle.textContent = b.onboarding.title;
    if (onboardSubtitle) onboardSubtitle.textContent = b.onboarding.subtitle;
    
    // Support link in sidebar
    if (b.supportUrl) {
        const nav = document.querySelector('.sidebar-nav');
        if (nav) {
            const helpLink = document.createElement('a');
            helpLink.href = b.supportUrl;
            helpLink.target = '_blank';
            helpLink.rel = 'noopener noreferrer';
            helpLink.className = 'nav-item';
            helpLink.innerHTML = '<i class="fas fa-life-ring"></i><span>Support</span>';
            nav.appendChild(helpLink);
        }
    }
    
    // Footer text
    if (b.footerText) {
        const footer = document.querySelector('.sidebar-footer');
        if (footer) {
            const footerEl = document.createElement('div');
            footerEl.className = 'sidebar-brand-footer';
            footerEl.textContent = b.footerText;
            footer.appendChild(footerEl);
        }
    }
}

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return r + ',' + g + ',' + b;
}

/* =============================================
   C. AUTHENTICATION
============================================= */

async function checkSession() {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) {
        console.error('Session error:', error);
        showLoginPage();
        return;
    }
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        showLoginPage();
    }
}

function showLoginPage() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('onboarding-page').style.display = 'none';
}

function showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('onboarding-page').style.display = 'none';
    updateSidebarUser();
    handleRoute();
}

function showOnboardingLayout() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('onboarding-page').style.display = 'block';
}

function updateSidebarUser() {
    if (!currentUser) return;
    const email = currentUser.email || '';
    const initials = email ? email[0].toUpperCase() : 'U';
    document.getElementById('sidebar-user-email').textContent = email;
    document.getElementById('sidebar-user-avatar').textContent = initials;
}

function setupAuthForms() {
    const loginForm    = document.getElementById('login-form');
    const signupForm   = document.getElementById('signup-form');
    const switchBtn    = document.getElementById('auth-switch-btn');
    const switchText   = document.getElementById('auth-switch-text');
    let isLogin = true;

    switchBtn.addEventListener('click', () => {
        isLogin = !isLogin;
        loginForm.style.display  = isLogin ? 'flex' : 'none';
        signupForm.style.display = isLogin ? 'none'  : 'flex';
        switchText.textContent   = isLogin ? "Don't have an account?" : "Already have an account?";
        switchBtn.textContent    = isLogin ? 'Sign up' : 'Sign in';
        document.getElementById('login-error').style.display  = 'none';
        document.getElementById('signup-error').style.display = 'none';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const btn      = document.getElementById('login-btn');
        const errEl    = document.getElementById('login-error');

        setButtonLoading(btn, true);
        errEl.style.display = 'none';

        const { data, error } = await sb.auth.signInWithPassword({ email, password });

        if (error) {
            errEl.textContent = error.message;
            errEl.style.display = 'block';
            setButtonLoading(btn, false);
        } else {
            currentUser = data.user;
            setButtonLoading(btn, false);
            showApp();
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const password2 = document.getElementById('signup-password2').value;
        const btn      = document.getElementById('signup-btn');
        const errEl    = document.getElementById('signup-error');

        errEl.style.display = 'none';

        if (password !== password2) {
            errEl.textContent = 'Passwords do not match.';
            errEl.style.display = 'block';
            return;
        }
        if (password.length < 8) {
            errEl.textContent = 'Password must be at least 8 characters.';
            errEl.style.display = 'block';
            return;
        }

        setButtonLoading(btn, true);

        const { data, error } = await sb.auth.signUp({ email, password });

        if (error) {
            errEl.textContent = error.message;
            errEl.style.display = 'block';
            setButtonLoading(btn, false);
        } else {
            setButtonLoading(btn, false);
            showToast('success', 'Account Created', 'Check your email to confirm your account.');
            // Switch to login form
            isLogin = true;
            loginForm.style.display  = 'flex';
            signupForm.style.display = 'none';
            switchText.textContent   = "Don't have an account?";
            switchBtn.textContent    = 'Sign up';
        }
    });

    // Logout buttons
    document.getElementById('logout-btn').addEventListener('click', doLogout);
    document.getElementById('topbar-logout').addEventListener('click', doLogout);
}

async function doLogout() {
    await sb.auth.signOut();
    currentUser = null;
    unsubscribeRealtime();
    showLoginPage();
    showToast('info', 'Signed Out', 'You have been signed out.');
}

// Auth state listener
sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
    }
});

/* =============================================
   C. UI FRAMEWORK
============================================= */

// Toast notifications
function showToast(type, title, message = '') {
    const container = document.getElementById('toast-container');
    const icons = {
        success: 'fa-circle-check',
        error:   'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info:    'fa-circle-info',
    };
    const id = 'toast-' + Date.now();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.id = id;
    el.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icons[type] || icons.info}"></i></div>
        <div class="toast-content">
            <div class="toast-title">${escHtml(title)}</div>
            ${message ? `<div class="toast-message">${escHtml(message)}</div>` : ''}
        </div>
        <button class="toast-close" onclick="removeToast('${id}')"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(el);
    setTimeout(() => removeToast(id), 4500);
}

function removeToast(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('removing');
    setTimeout(() => el.remove(), 350);
}

// Modal system
function openModal(title, bodyHtml, opts = {}) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    if (opts.size) modal.className = `modal modal-${opts.size}`;
    else modal.className = 'modal';
    document.getElementById('modal-overlay').style.display = 'flex';
    // Re-init any toggles in the modal
    initPasswordToggles(document.getElementById('modal-body'));
    // Focus first input
    setTimeout(() => {
        const firstInput = document.getElementById('modal-body').querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    }, 50);
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-body').innerHTML = '';
}

// Confirm dialog
function showConfirm(title, message, onConfirm, dangerLabel = 'Confirm') {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = dangerLabel;
    document.getElementById('confirm-overlay').style.display = 'flex';

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    newOkBtn.textContent = dangerLabel;

    newOkBtn.addEventListener('click', () => {
        closeConfirm();
        onConfirm();
    }, { once: true });
}

function closeConfirm() {
    document.getElementById('confirm-overlay').style.display = 'none';
}

// Password toggles
function initPasswordToggles(container = document) {
    container.querySelectorAll('.pw-toggle').forEach(btn => {
        // Remove old listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const targetId = newBtn.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                newBtn.querySelector('i').className = 'fa-solid fa-eye-slash';
            } else {
                input.type = 'password';
                newBtn.querySelector('i').className = 'fa-solid fa-eye';
            }
        });
    });
}

// Button loading state
function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    const textEl    = btn.querySelector('.btn-text');
    const spinnerEl = btn.querySelector('.btn-spinner');
    btn.disabled = isLoading;
    if (textEl)    textEl.style.display    = isLoading ? 'none' : '';
    if (spinnerEl) spinnerEl.style.display = isLoading ? 'inline-flex' : 'none';
}

// Table sorting
function sortTable(tableId, colIndex, dataType = 'string') {
    const table = document.getElementById(tableId);
    if (!table) return;
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    const rows  = Array.from(tbody.querySelectorAll('tr'));
    const headers = Array.from(thead.querySelectorAll('th'));
    const th = headers[colIndex];
    if (!th) return;

    const isAsc = th.classList.contains('sort-asc');
    headers.forEach(h => { h.classList.remove('sort-asc', 'sort-desc'); });
    th.classList.add(isAsc ? 'sort-desc' : 'sort-asc');

    rows.sort((a, b) => {
        const aVal = a.querySelectorAll('td')[colIndex]?.dataset.sort || a.querySelectorAll('td')[colIndex]?.textContent || '';
        const bVal = b.querySelectorAll('td')[colIndex]?.dataset.sort || b.querySelectorAll('td')[colIndex]?.textContent || '';
        let compare;
        if (dataType === 'number') {
            compare = parseFloat(aVal) - parseFloat(bVal);
        } else if (dataType === 'date') {
            compare = new Date(aVal) - new Date(bVal);
        } else {
            compare = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
        }
        return isAsc ? -compare : compare;
    });

    rows.forEach(r => tbody.appendChild(r));
}

// Make headers sortable
function makeTableSortable(tableId, colTypes = []) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.querySelectorAll('thead th').forEach((th, i) => {
        th.innerHTML = `${th.textContent} <i class="fa-solid fa-sort sort-icon"></i>`;
        th.addEventListener('click', () => sortTable(tableId, i, colTypes[i] || 'string'));
    });
}

// Loading spinner HTML
function loadingHTML(msg = 'Loading…') {
    return `<div class="loading-spinner"><div class="spinner"></div><span>${escHtml(msg)}</span></div>`;
}

// Empty state HTML
function emptyStateHTML(icon, title, msg, actionHtml = '') {
    return `
        <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid ${escHtml(icon)}"></i></div>
            <h3>${escHtml(title)}</h3>
            <p>${escHtml(msg)}</p>
            ${actionHtml}
        </div>
    `;
}

/* =============================================
   D. ROUTER
============================================= */

function handleRoute() {
    const hash = window.location.hash || '#dashboard';
    const area = document.getElementById('page-content');

    // Onboarding form — public, no auth required
    if (hash.startsWith('#onboard/')) {
        const token = hash.slice('#onboard/'.length);
        showOnboardingLayout();
        showOnboardingForm(token);
        return;
    }

    // If not authenticated, show login
    if (!currentUser) {
        showLoginPage();
        return;
    }

    // Make sure the app is shown
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('onboarding-page').style.display = 'none';

    // Unsubscribe realtime when navigating away from jobs/dashboard
    const navPage = hash.split('/')[0].slice(1);
    if (navPage !== 'jobs' && navPage !== 'dashboard') {
        unsubscribeRealtime();
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        const page = item.dataset.page;
        item.classList.toggle('active', hash === `#${page}` || hash.startsWith(`#${page}/`));
    });

    // Dispatch
    if (hash === '#dashboard') {
        renderDashboard(area);
    } else if (hash === '#clients') {
        renderClients(area);
    } else if (hash.startsWith('#client/')) {
        const id = hash.slice('#client/'.length);
        renderClientDetail(area, id);
    } else if (hash === '#onboarding') {
        renderOnboarding(area);
    } else if (hash === '#prompts') {
        renderPrompts(area);
    } else if (hash === '#workflow') {
        renderWorkflow(area);
    } else if (hash === '#jobs') {
        renderJobs(area);
    } else if (hash === '#settings') {
        renderSettings(area);
    } else {
        renderDashboard(area);
    }
}

/* =============================================
   E. SUPABASE DATA HELPERS
============================================= */

async function fetchClients() {
    const { data, error } = await sb.from('clients').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function fetchClient(id) {
    const { data, error } = await sb.from('clients').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

async function createClient(clientData) {
    const { data, error } = await sb.from('clients').insert([clientData]).select().single();
    if (error) throw error;
    return data;
}

async function updateClient(id, updates) {
    const { data, error } = await sb.from('clients').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

async function deleteClient(id) {
    const { error } = await sb.from('clients').delete().eq('id', id);
    if (error) throw error;
}

async function fetchOnboardingTokens() {
    const { data, error } = await sb.from('onboarding_tokens').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function createOnboardingToken(tokenData) {
    const { data, error } = await sb.from('onboarding_tokens').insert([tokenData]).select().single();
    if (error) throw error;
    return data;
}

async function fetchOnboardingToken(token) {
    const { data, error } = await sb.from('onboarding_tokens').select('*').eq('token', token).single();
    if (error) return null;
    return data;
}

async function updateOnboardingToken(id, updates) {
    const { data, error } = await sb.from('onboarding_tokens').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

async function fetchPromptTemplates() {
    const { data, error } = await sb.from('prompt_templates').select('*').order('category').order('name');
    if (error) throw error;
    return data || [];
}

async function upsertPromptTemplate(template) {
    const { data, error } = await sb.from('prompt_templates').upsert([template], { onConflict: 'id' }).select().single();
    if (error) throw error;
    return data;
}

async function fetchSettings() {
    const { data, error } = await sb.from('settings').select('*');
    if (error) throw error;
    // Convert array of {key, value} to an object
    const obj = {};
    (data || []).forEach(row => { obj[row.key] = row.value; });
    return obj;
}

async function upsertSetting(key, value) {
    const { data, error } = await sb.from('settings').upsert([{ key, value }], { onConflict: 'key' }).select().single();
    if (error) throw error;
    return data;
}

async function upsertSettings(settingsObj) {
    const rows = Object.entries(settingsObj).map(([key, value]) => ({ key, value: String(value) }));
    const { data, error } = await sb.from('settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;
    return data;
}

async function fetchJobs(filters = {}) {
    let query = supabase
        .from('jobs')
        .select('*, clients(business_name)')
        .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.client_id) query = query.eq('client_id', filters.client_id);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function fetchRecentJobs(limit = 10) {
    const { data, error } = await supabase
        .from('jobs')
        .select('*, clients(business_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data || [];
}

async function fetchRecentClients(limit = 5) {
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data || [];
}

async function updateJob(id, updates) {
    const { data, error } = await sb.from('jobs').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

async function fetchPluginFiles() {
    const { data, error } = await sb.from('plugin_files').select('*').order('name');
    if (error) throw error;
    return data || [];
}

async function createPluginFile(pluginData) {
    const { data, error } = await sb.from('plugin_files').insert([pluginData]).select().single();
    if (error) throw error;
    return data;
}

async function deletePluginFile(id) {
    const { error } = await sb.from('plugin_files').delete().eq('id', id);
    if (error) throw error;
}

async function fetchDashboardStats() {
    try {
        const { data, error } = await sb.rpc('get_dashboard_stats');
        if (error) throw error;
        return data;
    } catch (err) {
        // Fallback: compute stats from raw queries
        const [clients, jobs] = await Promise.all([
            sb.from('clients').select('id, status'),
            sb.from('jobs').select('id, status, created_at'),
        ]);
        const allClients = clients.data || [];
        const allJobs    = jobs.data    || [];
        const today      = new Date().toDateString();
        const completedToday = allJobs.filter(j =>
            j.status === 'completed' && new Date(j.created_at).toDateString() === today
        ).length;
        return {
            total_clients:    allClients.length,
            active_jobs:      allJobs.filter(j => j.status === 'running' || j.status === 'queued').length,
            completed_today:  completedToday,
            errors:           allJobs.filter(j => j.status === 'failed').length,
        };
    }
}

async function createWorkflowJobs(clientId, steps) {
    try {
        const { data, error } = await sb.rpc('create_workflow_jobs', {
            p_client_id: clientId,
            p_steps: steps,
        });
        if (error) throw error;
        return data;
    } catch (err) {
        // Fallback: insert jobs directly
        const jobRows = steps.map(step => ({
            client_id: clientId,
            task_type: step,
            status: 'queued',
            progress: 0,
        }));
        const { data, error: insertError } = await sb.from('jobs').insert(jobRows).select();
        if (insertError) throw insertError;
        return data;
    }
}

async function callWpProxy(clientId, endpoint, method = 'POST', payload = {}) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/wp-proxy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ client_id: clientId, endpoint, method, payload }),
    });
    return response.json();
}

async function callAiGenerate(prompt, templateCategory = null, variables = null) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt, template_category: templateCategory, variables }),
    });
    return response.json();
}

/* =============================================
   REALTIME SUBSCRIPTIONS
============================================= */

function subscribeToJobs(onUpdate) {
    unsubscribeRealtime();
    realtimeChannel = supabase
        .channel('jobs-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
            if (onUpdate) onUpdate(payload);
        })
        .subscribe((status) => {
            const dot = document.getElementById('realtime-dot');
            if (!dot) return;
            if (status === 'SUBSCRIBED') {
                dot.className = 'topbar-status-dot connected';
                dot.title = 'Realtime connected';
            } else if (status === 'CHANNEL_ERROR') {
                dot.className = 'topbar-status-dot error';
                dot.title = 'Realtime error';
            }
        });
}

function unsubscribeRealtime() {
    if (realtimeChannel) {
        sb.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    const dot = document.getElementById('realtime-dot');
    if (dot) {
        dot.className = 'topbar-status-dot';
        dot.title = 'Realtime disconnected';
    }
}

/* =============================================
   F. PAGE RENDERERS
============================================= */

/* ---- 1. DASHBOARD ---- */
async function renderDashboard(area) {
    currentPage = 'dashboard';
    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Dashboard</h1>
                <p>Welcome back${currentUser ? ', ' + escHtml(currentUser.email.split('@')[0]) : ''}. Here's what's happening.</p>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="window.location.hash='#workflow'">
                    <i class="fa-solid fa-gears"></i> Run Workflow
                </button>
            </div>
        </div>
        ${loadingHTML('Loading dashboard…')}
    `;

    try {
        const [stats, recentJobs, recentClients] = await Promise.all([
            fetchDashboardStats(),
            fetchRecentJobs(8),
            fetchRecentClients(5),
        ]);

        area.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Dashboard</h1>
                    <p>Welcome back${currentUser ? ', ' + escHtml(currentUser.email.split('@')[0]) : ''}. Here's what's happening.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-primary" onclick="window.location.hash='#workflow'">
                        <i class="fa-solid fa-gears"></i> Run Workflow
                    </button>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-card-top">
                        <span class="stat-card-label">Total Clients</span>
                        <div class="stat-card-icon stat-icon-blue"><i class="fa-solid fa-building"></i></div>
                    </div>
                    <div class="stat-card-value">${escHtml(String(stats?.total_clients ?? 0))}</div>
                    <div class="stat-card-change">All time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top">
                        <span class="stat-card-label">Active Jobs</span>
                        <div class="stat-card-icon stat-icon-amber"><i class="fa-solid fa-spinner"></i></div>
                    </div>
                    <div class="stat-card-value">${escHtml(String(stats?.active_jobs ?? 0))}</div>
                    <div class="stat-card-change">Running + Queued</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top">
                        <span class="stat-card-label">Completed Today</span>
                        <div class="stat-card-icon stat-icon-green"><i class="fa-solid fa-circle-check"></i></div>
                    </div>
                    <div class="stat-card-value">${escHtml(String(stats?.completed_today ?? 0))}</div>
                    <div class="stat-card-change">Since midnight</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top">
                        <span class="stat-card-label">Failed Jobs</span>
                        <div class="stat-card-icon stat-icon-red"><i class="fa-solid fa-circle-xmark"></i></div>
                    </div>
                    <div class="stat-card-value">${escHtml(String(stats?.errors ?? 0))}</div>
                    <div class="stat-card-change">Needs attention</div>
                </div>
            </div>

            <div class="grid-2">
                <!-- Recent Activity -->
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Recent Jobs</span>
                        <span class="realtime-badge" id="dash-realtime-badge">
                            <span class="dot"></span> Live
                        </span>
                    </div>
                    <div class="card-body" style="padding:0;" id="dash-jobs-feed">
                        ${buildActivityFeed(recentJobs)}
                    </div>
                    <div class="card-footer">
                        <a href="#jobs" class="btn btn-ghost btn-sm">View all jobs →</a>
                    </div>
                </div>

                <!-- Right column -->
                <div style="display:flex;flex-direction:column;gap:var(--space-5);">
                    <!-- Recent Clients -->
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Recent Clients</span>
                            <a href="#clients" class="btn btn-ghost btn-sm">View all</a>
                        </div>
                        <div class="card-body" style="padding:0;">
                            ${buildRecentClients(recentClients)}
                        </div>
                    </div>

                    <!-- Quick Actions -->
                    <div class="card">
                        <div class="card-header"><span class="card-title">Quick Actions</span></div>
                        <div class="card-body">
                            <div class="quick-actions">
                                <button class="quick-action-btn" onclick="window.location.hash='#clients'">
                                    <div class="quick-action-icon"><i class="fa-solid fa-user-plus"></i></div>
                                    <span class="quick-action-label">Add Client</span>
                                </button>
                                <button class="quick-action-btn" onclick="window.location.hash='#onboarding'">
                                    <div class="quick-action-icon"><i class="fa-solid fa-paper-plane"></i></div>
                                    <span class="quick-action-label">Send Onboarding</span>
                                </button>
                                <button class="quick-action-btn" onclick="window.location.hash='#workflow'">
                                    <div class="quick-action-icon"><i class="fa-solid fa-play"></i></div>
                                    <span class="quick-action-label">Run Workflow</span>
                                </button>
                                <button class="quick-action-btn" onclick="window.location.hash='#prompts'">
                                    <div class="quick-action-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
                                    <span class="quick-action-label">Edit Prompts</span>
                                </button>
                                <button class="quick-action-btn" onclick="window.location.hash='#jobs'">
                                    <div class="quick-action-icon"><i class="fa-solid fa-list-check"></i></div>
                                    <span class="quick-action-label">View Jobs</span>
                                </button>
                                <button class="quick-action-btn" onclick="window.location.hash='#settings'">
                                    <div class="quick-action-icon"><i class="fa-solid fa-sliders"></i></div>
                                    <span class="quick-action-label">Settings</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Subscribe to realtime for live job feed
        subscribeToJobs(async (payload) => {
            if (currentPage !== 'dashboard') return;
            const feed = document.getElementById('dash-jobs-feed');
            const badge = document.getElementById('dash-realtime-badge');
            if (badge) badge.classList.add('live');
            if (feed) {
                try {
                    const updated = await fetchRecentJobs(8);
                    feed.innerHTML = buildActivityFeed(updated);
                } catch (e) { /* ignore */ }
            }
        });

        const badge = document.getElementById('dash-realtime-badge');
        if (badge) badge.classList.add('live');

    } catch (err) {
        area.innerHTML += `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3>Failed to load dashboard</h3><p>${escHtml(err.message)}</p></div>`;
        showToast('error', 'Dashboard Error', err.message);
    }
}

function buildActivityFeed(jobs) {
    if (!jobs || jobs.length === 0) {
        return `<div style="padding:var(--space-6); text-align:center; color:var(--text-muted); font-size:0.85rem;">No recent jobs</div>`;
    }
    return `<div class="activity-feed" style="padding:0 var(--space-5);">
        ${jobs.map(job => {
            const info = getJobIcon(job.status);
            const clientName = job.clients?.business_name || 'Unknown Client';
            return `
                <div class="activity-item">
                    <div class="activity-icon ${info.cls}">
                        <i class="fa-solid ${info.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${escHtml(formatTaskType(job.task_type))} — ${escHtml(clientName)}</div>
                        <div class="activity-meta">${getStatusBadge(job.status)}</div>
                    </div>
                    <div class="activity-time">${timeAgo(job.created_at)}</div>
                </div>
            `;
        }).join('')}
    </div>`;
}

function buildRecentClients(clients) {
    if (!clients || clients.length === 0) {
        return `<div style="padding:var(--space-6); text-align:center; color:var(--text-muted); font-size:0.85rem;">No clients yet. <a href="#clients">Add one</a>.</div>`;
    }
    return `<div class="activity-feed" style="padding:0 var(--space-5);">
        ${clients.map(c => `
            <div class="activity-item">
                <div class="activity-icon stat-icon-blue">
                    <i class="fa-solid fa-building"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">
                        <a href="#client/${escHtml(c.id)}" style="color:var(--text-primary);text-decoration:none;">
                            ${escHtml(c.business_name || 'Unnamed')}
                        </a>
                    </div>
                    <div class="activity-meta">${escHtml(c.city || '')}${c.state ? ', ' + escHtml(c.state) : ''}</div>
                </div>
                <div class="activity-time">${getStatusBadge(c.status || 'active')}</div>
            </div>
        `).join('')}
    </div>`;
}

function formatTaskType(taskType) {
    if (!taskType) return 'Unknown';
    const step = WORKFLOW_STEPS.find(s => s.id === taskType);
    return step ? step.name : taskType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/* ---- 2. CLIENTS ---- */
async function renderClients(area) {
    currentPage = 'clients';
    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Clients</h1>
                <p>Manage all your SEO clients and their WordPress sites.</p>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" id="add-client-btn">
                    <i class="fa-solid fa-plus"></i> Add Client
                </button>
            </div>
        </div>
        ${loadingHTML('Loading clients…')}
    `;

    try {
        let clients = await fetchClients();
        clientsCache = clients;
        renderClientsTable(area, clients, 'all');

        document.getElementById('add-client-btn').addEventListener('click', () => {
            openClientModal(null, async () => {
                clients = await fetchClients();
                clientsCache = clients;
                const currentFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
                renderClientsTable(area, clients, currentFilter);
            });
        });

    } catch (err) {
        showToast('error', 'Error', err.message);
    }
}

function renderClientsTable(area, clients, filter) {
    const filtered = filter === 'all' ? clients : clients.filter(c => c.status === filter);

    const tableSection = document.getElementById('clients-table-section');
    const container = tableSection || area;

    const html = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Clients</h1>
                <p>Manage all your SEO clients and their WordPress sites.</p>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" id="add-client-btn">
                    <i class="fa-solid fa-plus"></i> Add Client
                </button>
            </div>
        </div>

        <div class="search-filter-bar">
            <div class="search-input-wrap">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="client-search" placeholder="Search clients…" />
            </div>
            <div class="filter-bar">
                <button class="filter-btn ${filter === 'all' ? 'active' : ''}" data-filter="all">All (${clients.length})</button>
                <button class="filter-btn ${filter === 'active' ? 'active' : ''}" data-filter="active">Active (${clients.filter(c=>c.status==='active').length})</button>
                <button class="filter-btn ${filter === 'onboarding' ? 'active' : ''}" data-filter="onboarding">Onboarding (${clients.filter(c=>c.status==='onboarding').length})</button>
                <button class="filter-btn ${filter === 'paused' ? 'active' : ''}" data-filter="paused">Paused (${clients.filter(c=>c.status==='paused').length})</button>
                <button class="filter-btn ${filter === 'error' ? 'active' : ''}" data-filter="error">Error (${clients.filter(c=>c.status==='error').length})</button>
            </div>
        </div>

        ${filtered.length === 0 ? `
            <div class="card">
                ${emptyStateHTML('building', 'No clients found', filter === 'all' ? 'Add your first client to get started.' : `No clients with status "${filter}".`)}
            </div>
        ` : `
            <div class="table-container">
                <table id="clients-table">
                    <thead>
                        <tr>
                            <th>Business Name</th>
                            <th>Location</th>
                            <th>Site URL</th>
                            <th>Niche</th>
                            <th>Status</th>
                            <th>Added</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(c => `
                            <tr data-id="${escHtml(c.id)}" data-search="${escHtml((c.business_name || '') + ' ' + (c.city || '') + ' ' + (c.niche || '')).toLowerCase()}">
                                <td>
                                    <a href="#client/${escHtml(c.id)}" style="font-weight:600; color:var(--text-primary);">
                                        ${escHtml(c.business_name || '—')}
                                    </a>
                                </td>
                                <td data-sort="${escHtml(c.city || '')}">
                                    ${c.city ? `${escHtml(c.city)}${c.state ? ', ' + escHtml(c.state) : ''}` : '—'}
                                </td>
                                <td>
                                    ${c.site_url ? `<a href="${escHtml(c.site_url)}" target="_blank" rel="noopener noreferrer" class="text-blue" style="font-size:0.8rem;">${escHtml(truncate(c.site_url.replace(/^https?:\/\//,''), 30))}</a>` : '—'}
                                </td>
                                <td class="td-muted">${escHtml(c.niche || '—')}</td>
                                <td data-sort="${escHtml(c.status || '')}">${getStatusBadge(c.status || 'active')}</td>
                                <td class="td-muted" data-sort="${escHtml(c.created_at || '')}">${formatDate(c.created_at)}</td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn-icon btn-icon-blue" title="View" onclick="window.location.hash='#client/${escHtml(c.id)}'"><i class="fa-solid fa-eye"></i></button>
                                        <button class="btn-icon btn-icon-blue" title="Edit" onclick="editClientBtn('${escHtml(c.id)}')"><i class="fa-solid fa-pen"></i></button>
                                        <button class="btn-icon btn-icon-green" title="Run Automation" onclick="runWorkflowForClient('${escHtml(c.id)}', '${escHtml(c.business_name || '')}')"><i class="fa-solid fa-play"></i></button>
                                        <button class="btn-icon btn-icon-danger" title="Delete" onclick="deleteClientBtn('${escHtml(c.id)}', '${escHtml(c.business_name || '')}')"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `}
    `;

    area.innerHTML = html;

    // Re-bind add client button
    const addBtn = document.getElementById('add-client-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openClientModal(null, async () => {
                const refreshed = await fetchClients();
                clientsCache = refreshed;
                const f = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
                renderClientsTable(area, refreshed, f);
            });
        });
    }

    // Filter buttons
    area.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            renderClientsTable(area, clients, btn.dataset.filter);
        });
    });

    // Search
    const searchInput = document.getElementById('client-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            area.querySelectorAll('tbody tr').forEach(row => {
                row.style.display = row.dataset.search?.includes(q) ? '' : 'none';
            });
        });
    }

    // Make table sortable
    makeTableSortable('clients-table', ['string', 'string', 'string', 'string', 'string', 'date']);
}

// Expose globally for inline handlers
window.editClientBtn = async function(id) {
    try {
        const client = await fetchClient(id);
        openClientModal(client, async () => {
            const refreshed = await fetchClients();
            clientsCache = refreshed;
            const area = document.getElementById('page-content');
            const f = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
            renderClientsTable(area, refreshed, f);
        });
    } catch (err) {
        showToast('error', 'Error', err.message);
    }
};

window.deleteClientBtn = function(id, name) {
    showConfirm('Delete Client', `Are you sure you want to delete "${name}"? This cannot be undone.`, async () => {
        try {
            await deleteClient(id);
            showToast('success', 'Deleted', `${name} has been deleted.`);
            const refreshed = await fetchClients();
            clientsCache = refreshed;
            const area = document.getElementById('page-content');
            const f = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
            renderClientsTable(area, refreshed, f);
        } catch (err) {
            showToast('error', 'Error', err.message);
        }
    }, 'Delete');
};

window.runWorkflowForClient = function(id, name) {
    window.location.hash = '#workflow';
    _memStore['workflow-preselect-client'] = id;
};

function openClientModal(client, onSave) {
    const isEdit = !!client;
    const title  = isEdit ? 'Edit Client' : 'Add New Client';

    const body = `
        <div class="form-group">
            <label for="cm-biz">Business Name <span class="required">*</span></label>
            <input type="text" id="cm-biz" value="${escHtml(client?.business_name || '')}" placeholder="Acme Roofing Co." required />
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="cm-niche">Niche</label>
                <input type="text" id="cm-niche" value="${escHtml(client?.niche || '')}" placeholder="Roofing, HVAC, Plumbing…" />
            </div>
            <div class="form-group">
                <label for="cm-status">Status</label>
                <select id="cm-status">
                    <option value="active"      ${client?.status === 'active'      ? 'selected' : ''}>Active</option>
                    <option value="onboarding"  ${client?.status === 'onboarding'  ? 'selected' : ''}>Onboarding</option>
                    <option value="paused"      ${client?.status === 'paused'      ? 'selected' : ''}>Paused</option>
                    <option value="error"       ${client?.status === 'error'       ? 'selected' : ''}>Error</option>
                </select>
            </div>
        </div>
        <div class="form-row-3">
            <div class="form-group">
                <label for="cm-city">City</label>
                <input type="text" id="cm-city" value="${escHtml(client?.city || '')}" placeholder="Dallas" />
            </div>
            <div class="form-group">
                <label for="cm-state">State</label>
                <input type="text" id="cm-state" value="${escHtml(client?.state || '')}" placeholder="Texas" />
            </div>
            <div class="form-group">
                <label for="cm-state-abbr">State Abbr.</label>
                <input type="text" id="cm-state-abbr" value="${escHtml(client?.state_abbr || '')}" maxlength="2" placeholder="TX" style="text-transform:uppercase;" />
            </div>
        </div>
        <div class="form-group">
            <label for="cm-address">Address</label>
            <input type="text" id="cm-address" value="${escHtml(client?.address || '')}" placeholder="123 Main St, Dallas TX 75001" />
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="cm-phone">Phone</label>
                <input type="tel" id="cm-phone" value="${escHtml(client?.phone || '')}" placeholder="(214) 555-0100" />
            </div>
            <div class="form-group">
                <label for="cm-email">Contact Email</label>
                <input type="email" id="cm-email" value="${escHtml(client?.email || '')}" placeholder="owner@acme.com" />
            </div>
        </div>
        <div class="form-group">
            <label for="cm-site-url">Site URL <span class="required">*</span></label>
            <input type="url" id="cm-site-url" value="${escHtml(client?.site_url || '')}" placeholder="https://acmeroofing.com" required />
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="cm-wp-user">WP Username</label>
                <input type="text" id="cm-wp-user" value="${escHtml(client?.wp_username || '')}" placeholder="admin" autocomplete="off" />
            </div>
            <div class="form-group">
                <label for="cm-wp-pass">WP App Password</label>
                <div class="input-with-icon">
                    <input type="password" id="cm-wp-pass" value="${escHtml(client?.wp_app_password || '')}" placeholder="xxxx xxxx xxxx xxxx" autocomplete="new-password" />
                    <button type="button" class="pw-toggle" data-target="cm-wp-pass" tabindex="-1"><i class="fa-solid fa-eye"></i></button>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label for="cm-services">Services (comma-separated)</label>
            <input type="text" id="cm-services" value="${escHtml(Array.isArray(client?.services) ? client.services.join(', ') : (client?.services || ''))}" placeholder="Roof Replacement, Roof Repair, Storm Damage…" />
        </div>
        <div class="form-group">
            <label for="cm-notes">Special Instructions</label>
            <textarea id="cm-notes" rows="3" placeholder="Any special notes for this client…">${escHtml(client?.notes || '')}</textarea>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" id="cm-save-btn">
                <span class="btn-text">${isEdit ? 'Save Changes' : 'Add Client'}</span>
                <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
            </button>
        </div>
    `;

    openModal(title, body, { size: 'lg' });

    // Auto-uppercase state_abbr
    const stateAbbrInput = document.getElementById('cm-state-abbr');
    if (stateAbbrInput) {
        stateAbbrInput.addEventListener('input', () => {
            stateAbbrInput.value = stateAbbrInput.value.toUpperCase().slice(0, 2);
        });
    }

    document.getElementById('cm-save-btn').addEventListener('click', async () => {
        const btn = document.getElementById('cm-save-btn');
        const biz = document.getElementById('cm-biz').value.trim();
        const siteUrl = document.getElementById('cm-site-url').value.trim();

        if (!biz) { showToast('warning', 'Required', 'Business name is required.'); return; }

        const rawServices = document.getElementById('cm-services').value;
        const services = rawServices ? rawServices.split(',').map(s => s.trim()).filter(Boolean) : [];

        const data = {
            business_name:   biz,
            niche:           document.getElementById('cm-niche').value.trim() || null,
            status:          document.getElementById('cm-status').value,
            city:            document.getElementById('cm-city').value.trim() || null,
            state:           document.getElementById('cm-state').value.trim() || null,
            state_abbr:      document.getElementById('cm-state-abbr').value.toUpperCase() || null,
            address:         document.getElementById('cm-address').value.trim() || null,
            phone:           document.getElementById('cm-phone').value.trim() || null,
            email:           document.getElementById('cm-email').value.trim() || null,
            site_url:        siteUrl || null,
            wp_username:     document.getElementById('cm-wp-user').value.trim() || null,
            wp_app_password: document.getElementById('cm-wp-pass').value || null,
            services:        services,
            notes:           document.getElementById('cm-notes').value.trim() || null,
        };

        setButtonLoading(btn, true);
        try {
            if (isEdit) {
                await updateClient(client.id, data);
                showToast('success', 'Saved', `${biz} updated successfully.`);
            } else {
                await createClient(data);
                showToast('success', 'Added', `${biz} added successfully.`);
            }
            closeModal();
            if (onSave) await onSave();
        } catch (err) {
            showToast('error', 'Error', err.message);
            setButtonLoading(btn, false);
        }
    });
}

/* ---- 3. CLIENT DETAIL ---- */
async function renderClientDetail(area, id) {
    currentPage = 'client-detail';
    area.innerHTML = `
        <button class="back-btn" onclick="window.location.hash='#clients'">
            <i class="fa-solid fa-arrow-left"></i> Back to Clients
        </button>
        ${loadingHTML('Loading client…')}
    `;

    try {
        const [client, clientJobs] = await Promise.all([
            fetchClient(id),
            fetchJobs({ client_id: id }),
        ]);

        area.innerHTML = `
            <button class="back-btn" onclick="window.location.hash='#clients'">
                <i class="fa-solid fa-arrow-left"></i> Back to Clients
            </button>

            <!-- Client Header -->
            <div class="client-detail-header">
                <div class="client-detail-info">
                    <div class="client-avatar">${escHtml((client.business_name || 'C')[0])}</div>
                    <div class="client-detail-meta">
                        <h2>${escHtml(client.business_name || 'Unnamed Client')}</h2>
                        <div class="client-detail-sub">
                            ${client.city ? `<span><i class="fa-solid fa-location-dot"></i> ${escHtml(client.city)}${client.state ? ', ' + escHtml(client.state) : ''}</span>` : ''}
                            ${client.site_url ? `<span><i class="fa-solid fa-globe"></i> <a href="${escHtml(client.site_url)}" target="_blank" rel="noopener noreferrer">${escHtml(client.site_url.replace(/^https?:\/\//, ''))}</a></span>` : ''}
                            ${client.niche ? `<span><i class="fa-solid fa-tag"></i> ${escHtml(client.niche)}</span>` : ''}
                            <span>${getStatusBadge(client.status || 'active')}</span>
                        </div>
                        <div class="client-detail-actions">
                            <button class="btn btn-ghost btn-sm" onclick="editClientBtn('${escHtml(client.id)}')">
                                <i class="fa-solid fa-pen"></i> Edit
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="runWorkflowForClient('${escHtml(client.id)}', '${escHtml(client.business_name || '')}')">
                                <i class="fa-solid fa-play"></i> Run Workflow
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteClientBtn('${escHtml(client.id)}', '${escHtml(client.business_name || '')}')">
                                <i class="fa-solid fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="tab-bar">
                <button class="tab-btn active" data-tab="overview">Overview</button>
                <button class="tab-btn" data-tab="jobs">Jobs (${clientJobs.length})</button>
                <button class="tab-btn" data-tab="wordpress">WordPress</button>
                <button class="tab-btn" data-tab="contact">Contact</button>
            </div>

            <!-- Overview Tab -->
            <div class="tab-panel active" id="tab-overview">
                <div class="grid-2">
                    <div class="card">
                        <div class="card-header"><span class="card-title">Business Info</span></div>
                        <div class="card-body">
                            <div class="info-grid">
                                <div class="info-item">
                                    <span class="info-label">Business Name</span>
                                    <span class="info-value">${escHtml(client.business_name || '—')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Niche</span>
                                    <span class="info-value">${escHtml(client.niche || '—')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Status</span>
                                    <span class="info-value">${getStatusBadge(client.status || 'active')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">City</span>
                                    <span class="info-value">${escHtml(client.city || '—')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">State</span>
                                    <span class="info-value">${escHtml(client.state || '—')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">State Abbr.</span>
                                    <span class="info-value">${escHtml(client.state_abbr || '—')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Address</span>
                                    <span class="info-value">${escHtml(client.address || '—')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Phone</span>
                                    <span class="info-value">${escHtml(client.phone || '—')}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Added</span>
                                    <span class="info-value">${formatDateTime(client.created_at)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><span class="card-title">Services</span></div>
                        <div class="card-body">
                            ${client.services && client.services.length > 0
                                ? `<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);">
                                    ${client.services.map(s => `<span class="badge badge-blue">${escHtml(s)}</span>`).join('')}
                                   </div>`
                                : `<span class="text-muted" style="font-size:0.85rem;">No services listed</span>`
                            }
                            ${client.notes ? `<div style="margin-top:var(--space-4);">
                                <div class="info-label" style="margin-bottom:var(--space-2);">Notes</div>
                                <div style="font-size:0.875rem;color:var(--text-secondary);line-height:1.6;">${escHtml(client.notes)}</div>
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Jobs Tab -->
            <div class="tab-panel" id="tab-jobs">
                ${clientJobs.length === 0
                    ? `<div class="card">${emptyStateHTML('list-check', 'No jobs yet', 'Run a workflow to create jobs for this client.', `<button class="btn btn-primary btn-sm" onclick="runWorkflowForClient('${escHtml(client.id)}', '${escHtml(client.business_name || '')}')"><i class="fa-solid fa-play"></i> Run Workflow</button>`)}</div>`
                    : `<div class="table-container">
                        <table id="client-jobs-table">
                            <thead><tr>
                                <th>Job ID</th>
                                <th>Task</th>
                                <th>Status</th>
                                <th>Progress</th>
                                <th>Created</th>
                                <th>Duration</th>
                                <th></th>
                            </tr></thead>
                            <tbody>
                                ${clientJobs.map(j => `
                                    <tr>
                                        <td><span class="uuid-short">${escHtml(shortUUID(j.id))}</span></td>
                                        <td style="font-weight:500;">${escHtml(formatTaskType(j.task_type))}</td>
                                        <td>${getStatusBadge(j.status)}</td>
                                        <td>
                                            <div style="display:flex;align-items:center;gap:var(--space-2);">
                                                <div class="progress-bar-wrap" style="flex:1;">
                                                    <div class="progress-bar-fill ${j.status === 'completed' ? 'green' : j.status === 'failed' ? 'red' : ''}"
                                                         style="width:${j.progress || 0}%"></div>
                                                </div>
                                                <span style="font-size:0.75rem;color:var(--text-muted);min-width:30px;">${j.progress || 0}%</span>
                                            </div>
                                        </td>
                                        <td class="td-muted">${timeAgo(j.created_at)}</td>
                                        <td class="td-muted">${getDuration(j.started_at, j.completed_at)}</td>
                                        <td>
                                            <div class="table-actions">
                                                <button class="btn-icon btn-icon-blue" title="View log" onclick="viewJobLog('${escHtml(j.id)}')"><i class="fa-solid fa-terminal"></i></button>
                                                ${j.status === 'failed' ? `<button class="btn-icon btn-icon-green" title="Retry" onclick="retryJob('${escHtml(j.id)}')"><i class="fa-solid fa-rotate-right"></i></button>` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`
                }
            </div>

            <!-- WordPress Tab -->
            <div class="tab-panel" id="tab-wordpress">
                <div class="card">
                    <div class="card-header"><span class="card-title">WordPress Connection</span></div>
                    <div class="card-body">
                        <div class="info-grid" style="grid-template-columns:1fr 1fr;">
                            <div class="info-item">
                                <span class="info-label">Site URL</span>
                                <span class="info-value">
                                    ${client.site_url ? `<a href="${escHtml(client.site_url)}" target="_blank" rel="noopener noreferrer">${escHtml(client.site_url)}</a>` : '—'}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">WP Username</span>
                                <span class="info-value">${escHtml(client.wp_username || '—')}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">WP App Password</span>
                                <span class="info-value">${client.wp_app_password ? '<span class="badge badge-green">Configured</span>' : '<span class="badge badge-red">Not set</span>'}</span>
                            </div>
                        </div>
                        <div style="margin-top:var(--space-6);">
                            <button class="btn btn-ghost btn-sm" onclick="testWpConnection('${escHtml(client.id)}')">
                                <i class="fa-solid fa-plug"></i> Test Connection
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Contact Tab -->
            <div class="tab-panel" id="tab-contact">
                <div class="card">
                    <div class="card-header"><span class="card-title">Contact Details</span></div>
                    <div class="card-body">
                        <div class="info-grid" style="grid-template-columns:1fr 1fr;">
                            <div class="info-item">
                                <span class="info-label">Email</span>
                                <span class="info-value">${client.email ? `<a href="mailto:${escHtml(client.email)}">${escHtml(client.email)}</a>` : '—'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Phone</span>
                                <span class="info-value">${client.phone ? `<a href="tel:${escHtml(client.phone)}">${escHtml(client.phone)}</a>` : '—'}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Address</span>
                                <span class="info-value">${escHtml(client.address || '—')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Tab switching
        area.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                area.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                area.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById(`tab-${btn.dataset.tab}`);
                if (panel) panel.classList.add('active');
            });
        });

        if (document.getElementById('client-jobs-table')) {
            makeTableSortable('client-jobs-table', ['string', 'string', 'string', 'number', 'date', 'string']);
        }

    } catch (err) {
        showToast('error', 'Error', err.message);
        area.innerHTML += `<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3>Failed to load client</h3><p>${escHtml(err.message)}</p></div>`;
    }
}

window.testWpConnection = async function(clientId) {
    showToast('info', 'Testing…', 'Checking WordPress connection…');
    try {
        const result = await callWpProxy(clientId, '/wp-json/wp/v2/posts?per_page=1', 'GET');
        if (result.error) throw new Error(result.error);
        showToast('success', 'Connected', 'WordPress connection is working.');
    } catch (err) {
        showToast('error', 'Connection Failed', err.message);
    }
};

/* ---- 4. ONBOARDING ---- */
async function renderOnboarding(area) {
    currentPage = 'onboarding';
    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Client Onboarding</h1>
                <p>Generate onboarding links and send invitations to new clients.</p>
            </div>
        </div>
        ${loadingHTML('Loading…')}
    `;

    try {
        const tokens = await fetchOnboardingTokens();

        area.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Client Onboarding</h1>
                    <p>Generate onboarding links and send invitations to new clients.</p>
                </div>
            </div>

            <div class="grid-2">
                <!-- Generate Link Card -->
                <div class="card">
                    <div class="card-header"><span class="card-title"><i class="fa-solid fa-link" style="color:var(--blue);margin-right:8px;"></i>Generate Onboarding Link</span></div>
                    <div class="card-body" style="gap:var(--space-4);">
                        <div class="form-group">
                            <label for="ob-client-name">Client / Business Name</label>
                            <input type="text" id="ob-client-name" placeholder="Acme Roofing Co." />
                        </div>
                        <div class="form-group">
                            <label for="ob-email">Client Email (optional)</label>
                            <input type="email" id="ob-email" placeholder="owner@acme.com" />
                        </div>
                        <div class="form-group">
                            <label for="ob-note">Custom Message (optional)</label>
                            <textarea id="ob-note" rows="2" placeholder="We'd love to learn more about your business…"></textarea>
                        </div>
                        <button class="btn btn-primary" id="ob-gen-btn">
                            <span class="btn-text"><i class="fa-solid fa-link"></i> Generate Link</span>
                            <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                        </button>
                        <div id="ob-link-result" style="display:none;"></div>
                    </div>
                </div>

                <!-- Send Email Invitation Card -->
                <div class="card">
                    <div class="card-header"><span class="card-title"><i class="fa-solid fa-paper-plane" style="color:var(--blue);margin-right:8px;"></i>Send Email Invitation</span></div>
                    <div class="card-body" style="gap:var(--space-4);">
                        <div class="form-group">
                            <label for="ob-send-name">Client Name</label>
                            <input type="text" id="ob-send-name" placeholder="John at Acme Roofing" />
                        </div>
                        <div class="form-group">
                            <label for="ob-send-email">Client Email <span class="required">*</span></label>
                            <input type="email" id="ob-send-email" placeholder="john@acmeroofing.com" required />
                        </div>
                        <div class="form-group">
                            <label for="ob-send-msg">Message</label>
                            <textarea id="ob-send-msg" rows="3" placeholder="Hi John, click the link below to fill out your onboarding form…"></textarea>
                        </div>
                        <button class="btn btn-success" id="ob-send-btn">
                            <span class="btn-text"><i class="fa-solid fa-paper-plane"></i> Generate & Copy Link</span>
                            <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                        </button>
                        <p class="form-hint">This generates a unique onboarding link. Copy and send it via your email client.</p>
                    </div>
                </div>
            </div>

            <!-- Tokens Table -->
            <div class="card" style="margin-top:var(--space-6);">
                <div class="card-header">
                    <span class="card-title">Onboarding Links</span>
                    <span class="text-muted" style="font-size:0.8rem;">${tokens.length} total</span>
                </div>
                <div id="ob-tokens-body">
                    ${renderTokensTable(tokens)}
                </div>
            </div>
        `;

        // Generate link handler
        document.getElementById('ob-gen-btn').addEventListener('click', async () => {
            const btn = document.getElementById('ob-gen-btn');
            const clientName = document.getElementById('ob-client-name').value.trim();
            const email      = document.getElementById('ob-email').value.trim();
            const note       = document.getElementById('ob-note').value.trim();
            if (!clientName) { showToast('warning', 'Required', 'Enter a client name.'); return; }

            setButtonLoading(btn, true);
            try {
                const token = generateSecureToken();
                const rec = await createOnboardingToken({
                    token,
                    client_name: clientName,
                    email: email || null,
                    note: note || null,
                    status: 'pending',
                });
                const link = `${window.location.origin}${window.location.pathname}#onboard/${token}`;
                const resultEl = document.getElementById('ob-link-result');
                resultEl.style.display = 'block';
                resultEl.innerHTML = `
                    <div style="margin-top:var(--space-2);">
                        <label style="font-size:0.8rem;font-weight:600;color:var(--text-muted);">Onboarding Link</label>
                        <div class="copy-link-box">
                            <span class="copy-link-url" id="gen-link-url">${escHtml(link)}</span>
                            <button class="btn btn-ghost btn-sm" onclick="copyToClipboard('${escHtml(link)}', this)">
                                <i class="fa-solid fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                `;
                showToast('success', 'Link Generated', 'Onboarding link is ready to share.');

                // Refresh tokens table
                const refreshedTokens = await fetchOnboardingTokens();
                document.getElementById('ob-tokens-body').innerHTML = renderTokensTable(refreshedTokens);
                bindTokenDeleteButtons();
            } catch (err) {
                showToast('error', 'Error', err.message);
            }
            setButtonLoading(btn, false);
        });

        // Send button handler (generates link + copies)
        document.getElementById('ob-send-btn').addEventListener('click', async () => {
            const btn    = document.getElementById('ob-send-btn');
            const name   = document.getElementById('ob-send-name').value.trim();
            const email  = document.getElementById('ob-send-email').value.trim();
            const msg    = document.getElementById('ob-send-msg').value.trim();
            if (!email) { showToast('warning', 'Required', 'Enter a client email.'); return; }

            setButtonLoading(btn, true);
            try {
                const token = generateSecureToken();
                await createOnboardingToken({
                    token,
                    client_name: name || null,
                    email,
                    note: msg || null,
                    status: 'pending',
                });
                const link = `${window.location.origin}${window.location.pathname}#onboard/${token}`;
                await navigator.clipboard.writeText(link);
                showToast('success', 'Copied!', 'Onboarding link copied to clipboard. Paste it into your email.');

                const refreshedTokens = await fetchOnboardingTokens();
                document.getElementById('ob-tokens-body').innerHTML = renderTokensTable(refreshedTokens);
                bindTokenDeleteButtons();
            } catch (err) {
                showToast('error', 'Error', err.message);
            }
            setButtonLoading(btn, false);
        });

        bindTokenDeleteButtons();

    } catch (err) {
        showToast('error', 'Error', err.message);
    }
}

function renderTokensTable(tokens) {
    if (tokens.length === 0) {
        return `<div style="padding:var(--space-6);text-align:center;color:var(--text-muted);font-size:0.85rem;">No onboarding links generated yet.</div>`;
    }
    return `
        <div class="table-container" style="border:none;border-radius:0;">
            <table id="tokens-table">
                <thead><tr>
                    <th>Token</th>
                    <th>Client Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                </tr></thead>
                <tbody>
                    ${tokens.map(t => {
                        const link = `${window.location.origin}${window.location.pathname}#onboard/${t.token}`;
                        return `
                            <tr class="token-row">
                                <td><span class="uuid-short">${escHtml(t.token ? t.token.slice(0,12) : '—')}…</span></td>
                                <td style="font-weight:500;">${escHtml(t.client_name || '—')}</td>
                                <td class="td-muted">${escHtml(t.email || '—')}</td>
                                <td>${getStatusBadge(t.status || 'pending')}</td>
                                <td class="td-muted">${formatDate(t.created_at)}</td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn-icon btn-icon-blue" title="Copy link" onclick="copyToClipboard('${escHtml(link)}', this)"><i class="fa-solid fa-copy"></i></button>
                                        <button class="btn-icon btn-icon-blue" title="Open form" onclick="window.open('${escHtml(link)}', '_blank')"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                                        <button class="btn-icon btn-icon-danger token-delete-btn" title="Delete" data-id="${escHtml(t.id)}" data-name="${escHtml(t.client_name || 'this token')}"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function bindTokenDeleteButtons() {
    document.querySelectorAll('.token-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id   = btn.dataset.id;
            const name = btn.dataset.name;
            showConfirm('Delete Token', `Delete the onboarding token for "${name}"?`, async () => {
                try {
                    const { error } = await sb.from('onboarding_tokens').delete().eq('id', id);
                    if (error) throw error;
                    showToast('success', 'Deleted', 'Onboarding token deleted.');
                    const refreshedTokens = await fetchOnboardingTokens();
                    document.getElementById('ob-tokens-body').innerHTML = renderTokensTable(refreshedTokens);
                    bindTokenDeleteButtons();
                } catch (err) {
                    showToast('error', 'Error', err.message);
                }
            }, 'Delete');
        });
    });
}

function generateSecureToken() {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

window.copyToClipboard = async function(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('success', 'Copied!', 'Link copied to clipboard.');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
            setTimeout(() => { if (btn) btn.innerHTML = orig; }, 2000);
        }
    } catch (err) {
        showToast('error', 'Copy Failed', 'Please copy the link manually.');
    }
};

/* ---- 5. ONBOARDING FORM (public) ---- */
async function showOnboardingForm(token) {
    const formArea = document.getElementById('onboarding-form-area');
    formArea.innerHTML = loadingHTML('Loading your form…');

    try {
        const tokenRecord = await fetchOnboardingToken(token);

        if (!tokenRecord) {
            formArea.innerHTML = `
                <div class="onboarding-invalid">
                    <div class="onboarding-invalid-icon"><i class="fa-solid fa-link-slash"></i></div>
                    <h2>Invalid or Expired Link</h2>
                    <p style="color:var(--text-secondary);margin-top:var(--space-3);">This onboarding link is not valid or has expired. Please contact your account manager for a new link.</p>
                </div>
            `;
            return;
        }

        if (tokenRecord.status === 'completed') {
            formArea.innerHTML = `
                <div class="onboarding-success">
                    <div class="onboarding-success-icon"><i class="fa-solid fa-check"></i></div>
                    <h2>Already Submitted!</h2>
                    <p style="color:var(--text-secondary);margin-top:var(--space-3);">This onboarding form has already been submitted. We'll be in touch soon.</p>
                </div>
            `;
            return;
        }

        formArea.innerHTML = `
            <div class="onboarding-welcome">
                <h1>Welcome${tokenRecord.client_name ? ', ' + escHtml(tokenRecord.client_name) : ''}!</h1>
                <p>${tokenRecord.note ? escHtml(tokenRecord.note) : 'Please fill out the form below so we can get your SEO campaign set up. This only takes a few minutes.'}</p>
            </div>
            <div class="onboarding-form-card">
                <form id="ob-client-form">
                    <div class="onboarding-section-title">Business Information</div>
                    <div class="form-group">
                        <label for="of-biz">Business Name <span class="required">*</span></label>
                        <input type="text" id="of-biz" value="${escHtml(tokenRecord.client_name || '')}" placeholder="Your Business Name" required />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="of-niche">Business Type / Niche</label>
                            <input type="text" id="of-niche" placeholder="e.g. Roofing, HVAC, Plumbing" />
                        </div>
                        <div class="form-group">
                            <label for="of-phone">Phone Number</label>
                            <input type="tel" id="of-phone" placeholder="(555) 123-4567" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="of-address">Business Address</label>
                        <input type="text" id="of-address" placeholder="123 Main St, Dallas TX 75001" />
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label for="of-city">City <span class="required">*</span></label>
                            <input type="text" id="of-city" placeholder="Dallas" required />
                        </div>
                        <div class="form-group">
                            <label for="of-state">State</label>
                            <input type="text" id="of-state" placeholder="Texas" />
                        </div>
                        <div class="form-group">
                            <label for="of-state-abbr">State Abbr.</label>
                            <input type="text" id="of-state-abbr" maxlength="2" placeholder="TX" style="text-transform:uppercase;" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="of-services">Services Offered <span class="required">*</span></label>
                        <input type="text" id="of-services" placeholder="Roof Replacement, Roof Repair, Storm Damage Repair…" required />
                        <span class="form-hint">Separate multiple services with commas.</span>
                    </div>

                    <div class="onboarding-section-title">Contact Details</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="of-email">Contact Email <span class="required">*</span></label>
                            <input type="email" id="of-email" value="${escHtml(tokenRecord.email || '')}" placeholder="owner@yourbusiness.com" required />
                        </div>
                    </div>

                    <div class="onboarding-section-title">Website Access</div>
                    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:var(--space-4);">We need these credentials to connect to your WordPress site. Your credentials are stored securely and only used to apply SEO changes.</p>
                    <div class="form-group">
                        <label for="of-site-url">Website URL <span class="required">*</span></label>
                        <input type="url" id="of-site-url" placeholder="https://yourbusiness.com" required />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="of-wp-user">WordPress Username <span class="required">*</span></label>
                            <input type="text" id="of-wp-user" placeholder="admin" autocomplete="off" required />
                        </div>
                        <div class="form-group">
                            <label for="of-wp-pass">WordPress Application Password <span class="required">*</span></label>
                            <div class="input-with-icon">
                                <input type="password" id="of-wp-pass" placeholder="xxxx xxxx xxxx xxxx" autocomplete="new-password" required />
                                <button type="button" class="pw-toggle" data-target="of-wp-pass" tabindex="-1"><i class="fa-solid fa-eye"></i></button>
                            </div>
                            <span class="form-hint">Generate in WP Admin → Users → Application Passwords</span>
                        </div>
                    </div>

                    <div class="onboarding-section-title">Additional Information</div>
                    <div class="form-group">
                        <label for="of-notes">Special Instructions or Notes</label>
                        <textarea id="of-notes" rows="4" placeholder="Anything else we should know about your business, target audience, or preferences…"></textarea>
                    </div>

                    <div style="margin-top:var(--space-8);">
                        <button type="submit" class="btn btn-primary btn-lg btn-full" id="of-submit-btn">
                            <span class="btn-text"><i class="fa-solid fa-paper-plane"></i> Submit Onboarding Form</span>
                            <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                        </button>
                    </div>
                </form>
            </div>
        `;

        // Auto-uppercase state abbr
        const stateAbbrInput = document.getElementById('of-state-abbr');
        stateAbbrInput.addEventListener('input', () => {
            stateAbbrInput.value = stateAbbrInput.value.toUpperCase().slice(0, 2);
        });

        initPasswordToggles(document);

        document.getElementById('ob-client-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('of-submit-btn');

            const biz      = document.getElementById('of-biz').value.trim();
            const city     = document.getElementById('of-city').value.trim();
            const siteUrl  = document.getElementById('of-site-url').value.trim();
            const wpUser   = document.getElementById('of-wp-user').value.trim();
            const wpPass   = document.getElementById('of-wp-pass').value;
            const servicesRaw = document.getElementById('of-services').value.trim();
            const services = servicesRaw ? servicesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

            if (!biz || !city || !siteUrl || !wpUser || !wpPass) {
                showToast('warning', 'Missing Fields', 'Please fill in all required fields.');
                return;
            }

            setButtonLoading(btn, true);

            try {
                const clientData = {
                    business_name:   biz,
                    niche:           document.getElementById('of-niche').value.trim() || null,
                    phone:           document.getElementById('of-phone').value.trim() || null,
                    address:         document.getElementById('of-address').value.trim() || null,
                    city,
                    state:           document.getElementById('of-state').value.trim() || null,
                    state_abbr:      document.getElementById('of-state-abbr').value.toUpperCase() || null,
                    email:           document.getElementById('of-email').value.trim() || null,
                    site_url:        siteUrl,
                    wp_username:     wpUser,
                    wp_app_password: wpPass,
                    services,
                    notes:           document.getElementById('of-notes').value.trim() || null,
                    status:          'onboarding',
                    onboarding_token: token,
                };

                // Insert client (anon insert policy required)
                const { error: clientError } = await sb.from('clients').insert([clientData]);
                if (clientError) throw clientError;

                // Mark token as completed
                await sb.from('onboarding_tokens').update({ status: 'completed' }).eq('token', token);

                // Show success
                formArea.innerHTML = `
                    <div class="onboarding-success">
                        <div class="onboarding-success-icon"><i class="fa-solid fa-check"></i></div>
                        <h2>Thank You, ${escHtml(biz)}!</h2>
                        <p style="color:var(--text-secondary);margin-top:var(--space-3);max-width:400px;margin-left:auto;margin-right:auto;">
                            Your onboarding form has been submitted successfully. Our team will review your information and begin setting up your SEO campaign shortly.
                        </p>
                        <p style="color:var(--text-muted);margin-top:var(--space-4);font-size:0.85rem;">You can close this window.</p>
                    </div>
                `;
            } catch (err) {
                showToast('error', 'Submission Failed', err.message);
                setButtonLoading(btn, false);
            }
        });

    } catch (err) {
        formArea.innerHTML = `<div class="onboarding-invalid">
            <div class="onboarding-invalid-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h2>Something went wrong</h2>
            <p style="color:var(--text-secondary);">${escHtml(err.message)}</p>
        </div>`;
    }
}


/* ---- 6. PROMPTS ---- */
async function renderPrompts(area) {
    currentPage = 'prompts';
    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Prompt Templates</h1>
                <p>Customize AI prompts for each automation step.</p>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-ghost" id="prompts-preview-btn"><i class="fa-solid fa-eye"></i> Preview</button>
                <button class="btn btn-primary" id="prompts-save-btn">
                    <span class="btn-text"><i class="fa-solid fa-floppy-disk"></i> Save All</span>
                    <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                </button>
            </div>
        </div>
        ${loadingHTML('Loading templates…')}
    `;

    try {
        let templates = await fetchPromptTemplates();

        // If no templates yet, create default placeholders from WORKFLOW_STEPS
        if (templates.length === 0) {
            templates = WORKFLOW_STEPS.map(step => ({
                id: null,
                name: step.name,
                category: step.id,
                prompt: `You are an expert SEO specialist. For the website of {business_name} located in {city}, {state}:\n\nTask: ${step.name}\n\nPage/Post Title: {title}\nBusiness Niche: {niche}\nServices: {service}\n\nPlease generate optimized content for this step.`,
            }));
        }

        const promptsListHtml = templates.map((t, i) => `
            <div class="prompt-template-card" id="ptc-${i}">
                <div class="prompt-template-header">
                    <div>
                        <div class="prompt-template-name">${escHtml(t.name || t.category || 'Unnamed')}</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Category: <code>${escHtml(t.category || '—')}</code></div>
                    </div>
                    <div style="display:flex;gap:var(--space-2);">
                        <button class="btn btn-ghost btn-sm" onclick="previewPrompt(${i})"><i class="fa-solid fa-eye"></i> Preview</button>
                    </div>
                </div>
                <div class="prompt-template-body">
                    <div class="form-group">
                        <label for="pt-name-${i}">Template Name</label>
                        <input type="text" id="pt-name-${i}" value="${escHtml(t.name || '')}" placeholder="Template name…" />
                    </div>
                    <div class="form-group">
                        <label for="pt-prompt-${i}">Prompt</label>
                        <textarea id="pt-prompt-${i}" rows="7" placeholder="Enter your prompt…">${escHtml(t.prompt || '')}</textarea>
                    </div>
                    ${t.id ? `<input type="hidden" id="pt-id-${i}" value="${escHtml(t.id)}" />` : ''}
                    <input type="hidden" id="pt-category-${i}" value="${escHtml(t.category || '')}" />
                </div>
            </div>
        `).join('');

        area.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Prompt Templates</h1>
                    <p>Customize AI prompts for each automation step. Use template variables to personalize output.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-primary" id="prompts-save-btn">
                        <span class="btn-text"><i class="fa-solid fa-floppy-disk"></i> Save All</span>
                        <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                    </button>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 300px;gap:var(--space-6);align-items:start;">
                <div id="prompts-list">
                    ${promptsListHtml}
                </div>

                <!-- Variables Panel -->
                <div class="template-var-panel" style="position:sticky;top:var(--space-4);">
                    <div class="card-header"><span class="card-title"><i class="fa-solid fa-code" style="color:var(--blue);margin-right:6px;"></i>Template Variables</span></div>
                    <div>
                        ${TEMPLATE_VARIABLES.map(v => `
                            <div class="template-var-item">
                                <span class="template-var-code">${escHtml(v.var)}</span>
                                <span class="template-var-desc">${escHtml(v.desc)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Save All
        document.getElementById('prompts-save-btn').addEventListener('click', async () => {
            const btn = document.getElementById('prompts-save-btn');
            setButtonLoading(btn, true);
            let saved = 0;
            let errors = 0;
            for (let i = 0; i < templates.length; i++) {
                try {
                    const name     = document.getElementById(`pt-name-${i}`)?.value.trim();
                    const prompt   = document.getElementById(`pt-prompt-${i}`)?.value.trim();
                    const category = document.getElementById(`pt-category-${i}`)?.value;
                    const idEl     = document.getElementById(`pt-id-${i}`);
                    const id       = idEl ? idEl.value : null;

                    const payload = { name, prompt, category };
                    if (id) payload.id = id;

                    await upsertPromptTemplate(payload);
                    saved++;
                } catch (err) {
                    errors++;
                    console.error('Failed to save template', i, err);
                }
            }
            setButtonLoading(btn, false);
            if (errors === 0) {
                showToast('success', 'Saved', `${saved} template(s) saved successfully.`);
            } else {
                showToast('warning', 'Partial Save', `${saved} saved, ${errors} failed.`);
            }
            // Refresh templates data
            templates = await fetchPromptTemplates();
        });

    } catch (err) {
        showToast('error', 'Error', err.message);
    }
}

window.previewPrompt = function(index) {
    const prompt = document.getElementById(`pt-prompt-${index}`)?.value || '';
    const name   = document.getElementById(`pt-name-${index}`)?.value || 'Preview';

    const sampleData = {
        '{title}':           'Dallas Roof Replacement Services',
        '{location}':        'Dallas, TX',
        '{city}':            'Dallas',
        '{state}':           'Texas',
        '{state_abbr}':      'TX',
        '{business_name}':   'Acme Roofing Co.',
        '{service}':         'Roof Replacement',
        '{niche}':           'Roofing',
        '{phone}':           '(214) 555-0100',
        '{address}':         '123 Main St, Dallas TX 75001',
        '{existing_content}': '[existing page content here]',
        '{existing_titles}':  '[blog titles from sitemap]',
        '{focus_keyword}':   'Dallas roof replacement',
        '{count}':           '5',
    };

    let preview = prompt;
    for (const [key, val] of Object.entries(sampleData)) {
        preview = preview.split(key).join(`<mark style="background:var(--blue-bg);color:var(--blue);border-radius:3px;padding:0 2px;">${escHtml(val)}</mark>`);
    }

    openModal(`Preview: ${escHtml(name)}`, `
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:var(--space-3);">
            Template variables replaced with sample data:
        </div>
        <div style="background:var(--bg-deep);border:1px solid var(--border);border-radius:var(--radius);padding:var(--space-4);font-size:0.875rem;line-height:1.8;white-space:pre-wrap;word-break:break-word;max-height:400px;overflow-y:auto;">${preview}</div>
    `, { size: 'lg' });
};

/* ---- 7. WORKFLOW ---- */
async function renderWorkflow(area) {
    currentPage = 'workflow';
    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Workflow</h1>
                <p>Configure and run the SEO automation pipeline.</p>
            </div>
        </div>
        ${loadingHTML('Loading…')}
    `;

    try {
        const clients = await fetchClients();
        const activeClients = clients.filter(c => c.status === 'active' || c.status === 'onboarding');

        // Check if a client was pre-selected
        const preselect = _memStore['workflow-preselect-client'] || null;
        delete _memStore['workflow-preselect-client'];

        area.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Workflow</h1>
                    <p>Select a client and configure which steps to run.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-ghost" id="wf-run-selected-btn" ${activeClients.length === 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-play"></i> Run Selected
                    </button>
                    <button class="btn btn-primary" id="wf-run-all-btn" ${activeClients.length === 0 ? 'disabled' : ''}>
                        <span class="btn-text"><i class="fa-solid fa-forward-fast"></i> Run All Steps</span>
                        <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                    </button>
                </div>
            </div>

            <div class="grid-2" style="align-items:start;">
                <!-- Pipeline -->
                <div>
                    <div class="card" style="margin-bottom:var(--space-5);">
                        <div class="card-header">
                            <span class="card-title">Select Client</span>
                        </div>
                        <div class="card-body">
                            ${activeClients.length === 0
                                ? `<p class="text-muted" style="font-size:0.875rem;">No active clients found. <a href="#clients">Add a client</a> first.</p>`
                                : `<select id="wf-client-select">
                                    <option value="">— Select a client —</option>
                                    ${activeClients.map(c => `
                                        <option value="${escHtml(c.id)}" ${preselect === c.id ? 'selected' : ''}>
                                            ${escHtml(c.business_name || 'Unnamed')}${c.city ? ' — ' + escHtml(c.city) : ''}
                                        </option>
                                    `).join('')}
                                   </select>`
                            }
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Pipeline Steps</span>
                            <div style="display:flex;gap:var(--space-2);">
                                <button class="btn btn-ghost btn-sm" id="wf-select-all">Select All</button>
                                <button class="btn btn-ghost btn-sm" id="wf-deselect-all">Deselect All</button>
                            </div>
                        </div>
                        <div class="card-body" style="padding:var(--space-4);">
                            <div class="workflow-pipeline" id="workflow-pipeline">
                                ${WORKFLOW_STEPS.map((step, i) => {
                                    const enabled = workflowEnabledSteps.has(step.id);
                                    return `
                                        <div class="workflow-step ${enabled ? 'enabled' : 'disabled'}" id="wf-step-${step.id}">
                                            <div class="workflow-step-num">${i + 1}</div>
                                            <div class="workflow-step-icon"><i class="fa-solid ${escHtml(step.icon)}"></i></div>
                                            <div class="workflow-step-info">
                                                <div class="workflow-step-name">${escHtml(step.name)}</div>
                                                <div class="workflow-step-id">${escHtml(step.id)}</div>
                                            </div>
                                            <label class="toggle">
                                                <input type="checkbox" class="wf-step-toggle" data-step="${escHtml(step.id)}" ${enabled ? 'checked' : ''} />
                                                <span class="toggle-slider"></span>
                                            </label>
                                        </div>
                                        ${i < WORKFLOW_STEPS.length - 1 ? '<div class="workflow-connector"></div>' : ''}
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Info / Status -->
                <div style="display:flex;flex-direction:column;gap:var(--space-5);">
                    <div class="card">
                        <div class="card-header"><span class="card-title">Workflow Summary</span></div>
                        <div class="card-body">
                            <div class="info-grid" style="grid-template-columns:1fr 1fr;">
                                <div class="info-item">
                                    <span class="info-label">Total Steps</span>
                                    <span class="info-value">${WORKFLOW_STEPS.length}</span>
                                </div>
                                <div class="info-item">
                                    <span class="info-label">Selected</span>
                                    <span class="info-value" id="wf-selected-count">${workflowEnabledSteps.size}</span>
                                </div>
                            </div>
                            <div style="margin-top:var(--space-4);">
                                <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">Selected Steps</label>
                                <div style="margin-top:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);" id="wf-selected-list">
                                    ${WORKFLOW_STEPS.filter(s => workflowEnabledSteps.has(s.id)).map(s =>
                                        `<div style="display:flex;align-items:center;gap:var(--space-2);font-size:0.82rem;color:var(--text-secondary);">
                                            <i class="fa-solid fa-check text-green" style="font-size:0.7rem;"></i> ${escHtml(s.name)}
                                        </div>`
                                    ).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">How It Works</span></div>
                        <div class="card-body">
                            <div style="display:flex;flex-direction:column;gap:var(--space-3);">
                                <div style="display:flex;gap:var(--space-3);align-items:flex-start;">
                                    <div class="workflow-step-icon" style="background:var(--blue-bg);color:var(--blue);flex-shrink:0;"><i class="fa-solid fa-1"></i></div>
                                    <div>
                                        <div style="font-size:0.875rem;font-weight:600;">Select Client & Steps</div>
                                        <div style="font-size:0.8rem;color:var(--text-muted);">Choose a client and enable the workflow steps to run.</div>
                                    </div>
                                </div>
                                <div style="display:flex;gap:var(--space-3);align-items:flex-start;">
                                    <div class="workflow-step-icon" style="background:var(--blue-bg);color:var(--blue);flex-shrink:0;"><i class="fa-solid fa-2"></i></div>
                                    <div>
                                        <div style="font-size:0.875rem;font-weight:600;">Jobs Are Queued</div>
                                        <div style="font-size:0.8rem;color:var(--text-muted);">Each step becomes a job in the queue, processed in order.</div>
                                    </div>
                                </div>
                                <div style="display:flex;gap:var(--space-3);align-items:flex-start;">
                                    <div class="workflow-step-icon" style="background:var(--green-bg);color:var(--green);flex-shrink:0;"><i class="fa-solid fa-3"></i></div>
                                    <div>
                                        <div style="font-size:0.875rem;font-weight:600;">Monitor in Jobs</div>
                                        <div style="font-size:0.8rem;color:var(--text-muted);">Track progress in real-time on the Jobs page.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Toggle step handler
        document.querySelectorAll('.wf-step-toggle').forEach(cb => {
            cb.addEventListener('change', () => {
                const stepId = cb.dataset.step;
                if (cb.checked) {
                    workflowEnabledSteps.add(stepId);
                } else {
                    workflowEnabledSteps.delete(stepId);
                }
                const stepEl = document.getElementById(`wf-step-${stepId}`);
                if (stepEl) {
                    stepEl.classList.toggle('enabled', cb.checked);
                    stepEl.classList.toggle('disabled', !cb.checked);
                }
                updateWorkflowSummary();
            });
        });

        // Select/deselect all
        document.getElementById('wf-select-all').addEventListener('click', () => {
            WORKFLOW_STEPS.forEach(s => workflowEnabledSteps.add(s.id));
            document.querySelectorAll('.wf-step-toggle').forEach(cb => { cb.checked = true; });
            document.querySelectorAll('.workflow-step').forEach(el => { el.classList.add('enabled'); el.classList.remove('disabled'); });
            updateWorkflowSummary();
        });

        document.getElementById('wf-deselect-all').addEventListener('click', () => {
            workflowEnabledSteps.clear();
            document.querySelectorAll('.wf-step-toggle').forEach(cb => { cb.checked = false; });
            document.querySelectorAll('.workflow-step').forEach(el => { el.classList.remove('enabled'); el.classList.add('disabled'); });
            updateWorkflowSummary();
        });

        // Run handlers
        async function doRunWorkflow(stepsToRun) {
            const clientId = document.getElementById('wf-client-select')?.value;
            if (!clientId) { showToast('warning', 'Select Client', 'Please select a client first.'); return; }
            if (stepsToRun.length === 0) { showToast('warning', 'No Steps', 'Please select at least one step.'); return; }

            const client = activeClients.find(c => c.id === clientId);
            const btn = document.getElementById('wf-run-all-btn');
            setButtonLoading(btn, true);

            try {
                await createWorkflowJobs(clientId, stepsToRun);
                showToast('success', 'Workflow Started', `${stepsToRun.length} job(s) queued for ${client?.business_name || 'client'}.`);
                setTimeout(() => { window.location.hash = '#jobs'; }, 1200);
            } catch (err) {
                showToast('error', 'Error', err.message);
                setButtonLoading(btn, false);
            }
        }

        document.getElementById('wf-run-all-btn').addEventListener('click', () => {
            doRunWorkflow(WORKFLOW_STEPS.map(s => s.id));
        });

        document.getElementById('wf-run-selected-btn').addEventListener('click', () => {
            doRunWorkflow([...workflowEnabledSteps]);
        });

    } catch (err) {
        showToast('error', 'Error', err.message);
    }
}

function updateWorkflowSummary() {
    const countEl = document.getElementById('wf-selected-count');
    const listEl  = document.getElementById('wf-selected-list');
    if (countEl) countEl.textContent = workflowEnabledSteps.size;
    if (listEl) {
        listEl.innerHTML = WORKFLOW_STEPS.filter(s => workflowEnabledSteps.has(s.id)).map(s =>
            `<div style="display:flex;align-items:center;gap:var(--space-2);font-size:0.82rem;color:var(--text-secondary);">
                <i class="fa-solid fa-check text-green" style="font-size:0.7rem;"></i> ${escHtml(s.name)}
            </div>`
        ).join('') || `<span class="text-muted" style="font-size:0.82rem;">No steps selected</span>`;
    }
}

/* ---- 8. JOBS ---- */
async function renderJobs(area) {
    currentPage = 'jobs';
    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Jobs</h1>
                <p>Monitor and manage all automation jobs.</p>
            </div>
            <div class="page-header-actions">
                <span class="realtime-badge" id="jobs-realtime-badge">
                    <span class="dot"></span> Live
                </span>
            </div>
        </div>
        ${loadingHTML('Loading jobs…')}
    `;

    try {
        let jobs = await fetchJobs();
        let currentFilter = 'all';

        renderJobsTable(area, jobs, currentFilter);

        // Subscribe to realtime
        subscribeToJobs(async (payload) => {
            if (currentPage !== 'jobs') return;
            const badge = document.getElementById('jobs-realtime-badge');
            if (badge) badge.classList.add('live');
            jobs = await fetchJobs();
            const f = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
            renderJobsTable(area, jobs, f);
        });

        const badge = document.getElementById('jobs-realtime-badge');
        if (badge) badge.classList.add('live');

    } catch (err) {
        showToast('error', 'Error', err.message);
    }
}

function renderJobsTable(area, jobs, filter) {
    const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Jobs</h1>
                <p>Monitor and manage all automation jobs in real-time.</p>
            </div>
            <div class="page-header-actions">
                <span class="realtime-badge" id="jobs-realtime-badge live">
                    <span class="dot"></span> Live
                </span>
            </div>
        </div>

        <div class="search-filter-bar">
            <div class="search-input-wrap">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="jobs-search" placeholder="Search jobs…" />
            </div>
            <div class="filter-bar">
                <button class="filter-btn ${filter === 'all' ? 'active' : ''}" data-filter="all">All (${jobs.length})</button>
                <button class="filter-btn ${filter === 'queued' ? 'active' : ''}" data-filter="queued">Queued (${jobs.filter(j=>j.status==='queued').length})</button>
                <button class="filter-btn ${filter === 'running' ? 'active' : ''}" data-filter="running">Running (${jobs.filter(j=>j.status==='running').length})</button>
                <button class="filter-btn ${filter === 'completed' ? 'active' : ''}" data-filter="completed">Completed (${jobs.filter(j=>j.status==='completed').length})</button>
                <button class="filter-btn ${filter === 'failed' ? 'active' : ''}" data-filter="failed">Failed (${jobs.filter(j=>j.status==='failed').length})</button>
            </div>
        </div>

        ${filtered.length === 0
            ? `<div class="card">${emptyStateHTML('list-check', 'No jobs found', filter === 'all' ? 'Run a workflow to start creating jobs.' : `No ${filter} jobs.`)}</div>`
            : `<div class="table-container">
                <table id="jobs-table">
                    <thead><tr>
                        <th>Job ID</th>
                        <th>Client</th>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Created</th>
                        <th>Duration</th>
                        <th></th>
                    </tr></thead>
                    <tbody>
                        ${filtered.map(j => `
                            <tr data-id="${escHtml(j.id)}" data-search="${escHtml((j.task_type || '') + ' ' + (j.clients?.business_name || '')).toLowerCase()}">
                                <td><span class="uuid-short">${escHtml(shortUUID(j.id))}</span></td>
                                <td style="font-weight:500;">
                                    ${j.clients?.business_name
                                        ? `<a href="#client/${escHtml(j.client_id)}" style="color:var(--text-primary);">${escHtml(j.clients.business_name)}</a>`
                                        : '<span class="td-muted">—</span>'
                                    }
                                </td>
                                <td>${escHtml(formatTaskType(j.task_type))}</td>
                                <td data-sort="${escHtml(j.status)}">${getStatusBadge(j.status)}</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:var(--space-2);">
                                        <div class="progress-bar-wrap" style="flex:1;">
                                            <div class="progress-bar-fill ${j.status === 'completed' ? 'green' : j.status === 'failed' ? 'red' : j.status === 'running' ? '' : ''}"
                                                 style="width:${j.status === 'completed' ? 100 : j.progress || 0}%"></div>
                                        </div>
                                        <span style="font-size:0.75rem;color:var(--text-muted);min-width:28px;">${j.status === 'completed' ? 100 : (j.progress || 0)}%</span>
                                    </div>
                                </td>
                                <td class="td-muted" data-sort="${escHtml(j.created_at || '')}">${timeAgo(j.created_at)}</td>
                                <td class="td-muted">${getDuration(j.started_at, j.completed_at)}</td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn-icon btn-icon-blue" title="View log" onclick="viewJobLog('${escHtml(j.id)}')"><i class="fa-solid fa-terminal"></i></button>
                                        ${j.status === 'failed' ? `<button class="btn-icon btn-icon-green" title="Retry" onclick="retryJob('${escHtml(j.id)}')"><i class="fa-solid fa-rotate-right"></i></button>` : ''}
                                        ${j.status === 'queued' || j.status === 'running' ? `<button class="btn-icon btn-icon-danger" title="Cancel" onclick="cancelJob('${escHtml(j.id)}')"><i class="fa-solid fa-ban"></i></button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`
        }
    `;

    // Re-subscribe realtime badge
    setTimeout(() => {
        const badge = document.getElementById('jobs-realtime-badge');
        if (badge) badge.classList.add('live');
    }, 100);

    // Filter buttons
    area.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            renderJobsTable(area, jobs, btn.dataset.filter);
            // Re-subscribe to realtime
            subscribeToJobs(async (payload) => {
                if (currentPage !== 'jobs') return;
                jobs = await fetchJobs();
                const f = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
                renderJobsTable(area, jobs, f);
            });
        });
    });

    // Search
    const searchInput = document.getElementById('jobs-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            area.querySelectorAll('tbody tr').forEach(row => {
                row.style.display = row.dataset.search?.includes(q) ? '' : 'none';
            });
        });
    }

    makeTableSortable('jobs-table', ['string', 'string', 'string', 'string', 'number', 'date', 'string']);
}

window.viewJobLog = async function(jobId) {
    openModal('Job Log', loadingHTML('Loading log…'));
    try {
        const { data: job, error } = await sb.from('jobs').select('*').eq('id', jobId).single();
        if (error) throw error;

        const log = job.log || job.error_message || null;
        const logHtml = log
            ? log.split('\n').map(line => {
                const cls = line.match(/error|fail/i) ? 'log-line-error'
                    : line.match(/warn/i) ? 'log-line-warn'
                    : line.match(/ok|success|done|complete/i) ? 'log-line-ok'
                    : 'log-line-info';
                return `<div class="${cls}">${escHtml(line)}</div>`;
              }).join('')
            : '<div class="log-line-info">No log data available for this job.</div>';

        document.getElementById('modal-body').innerHTML = `
            <div class="info-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:var(--space-4);">
                <div class="info-item">
                    <span class="info-label">Job ID</span>
                    <span class="info-value"><span class="uuid-short">${escHtml(shortUUID(job.id))}</span></span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status</span>
                    <span class="info-value">${getStatusBadge(job.status)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Progress</span>
                    <span class="info-value">${job.progress || 0}%</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Task</span>
                    <span class="info-value">${escHtml(formatTaskType(job.task_type))}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Started</span>
                    <span class="info-value">${formatDateTime(job.started_at)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Completed</span>
                    <span class="info-value">${formatDateTime(job.completed_at)}</span>
                </div>
            </div>
            <div>
                <label style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:var(--space-2);">Log Output</label>
                <div class="job-log">${logHtml}</div>
            </div>
            ${job.error_message && !log ? `
                <div style="margin-top:var(--space-4);">
                    <label style="font-size:0.75rem;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:var(--space-2);">Error</label>
                    <div class="job-log" style="border-color:var(--red);">${escHtml(job.error_message)}</div>
                </div>
            ` : ''}
        `;
    } catch (err) {
        document.getElementById('modal-body').innerHTML = `<p class="text-red">${escHtml(err.message)}</p>`;
    }
};

window.retryJob = async function(jobId) {
    try {
        await updateJob(jobId, { status: 'queued', progress: 0, error_message: null, started_at: null, completed_at: null });
        showToast('success', 'Retrying', 'Job has been re-queued.');
        const area = document.getElementById('page-content');
        const jobs = await fetchJobs();
        const f = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        renderJobsTable(area, jobs, f);
    } catch (err) {
        showToast('error', 'Error', err.message);
    }
};

window.cancelJob = async function(jobId) {
    showConfirm('Cancel Job', 'Are you sure you want to cancel this job?', async () => {
        try {
            await updateJob(jobId, { status: 'cancelled' });
            showToast('info', 'Cancelled', 'Job has been cancelled.');
            const area = document.getElementById('page-content');
            const jobs = await fetchJobs();
            const f = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
            renderJobsTable(area, jobs, f);
        } catch (err) {
            showToast('error', 'Error', err.message);
        }
    }, 'Cancel Job');
};

/* ---- 9. SETTINGS ---- */
async function renderSettings(area) {
    currentPage = 'settings';
    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Settings</h1>
                <p>Configure AI providers, email, plugins, and defaults.</p>
            </div>
            <div class="page-header-actions">
                <button class="btn btn-primary" id="settings-save-btn">
                    <span class="btn-text"><i class="fa-solid fa-floppy-disk"></i> Save Settings</span>
                    <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                </button>
            </div>
        </div>
        ${loadingHTML('Loading settings…')}
    `;

    try {
        const [settings, plugins] = await Promise.all([
            fetchSettings(),
            fetchPluginFiles(),
        ]);

        area.innerHTML = `
            <div class="page-header">
                <div class="page-header-left">
                    <h1>Settings</h1>
                    <p>Configure AI providers, email, plugins, and defaults.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-primary" id="settings-save-btn">
                        <span class="btn-text"><i class="fa-solid fa-floppy-disk"></i> Save Settings</span>
                        <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                    </button>
                </div>
            </div>

            <!-- AI Configuration -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i class="fa-solid fa-robot"></i>
                    <span class="settings-section-title">AI Configuration</span>
                </div>
                <div class="settings-section-body">
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-ai-provider">AI Provider</label>
                            <select id="s-ai-provider">
                                <option value="openai" ${settings.ai_provider === 'openai' || !settings.ai_provider ? 'selected' : ''}>OpenAI</option>
                                <option value="anthropic" ${settings.ai_provider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="s-ai-model">Model</label>
                            <select id="s-ai-model">
                                <option value="gpt-4o" ${settings.ai_model === 'gpt-4o' || !settings.ai_model ? 'selected' : ''}>GPT-4o</option>
                                <option value="gpt-4o-mini" ${settings.ai_model === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini</option>
                                <option value="gpt-4-turbo" ${settings.ai_model === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
                                <option value="claude-3-5-sonnet-20241022" ${settings.ai_model === 'claude-3-5-sonnet-20241022' ? 'selected' : ''}>Claude 3.5 Sonnet</option>
                                <option value="claude-3-haiku-20240307" ${settings.ai_model === 'claude-3-haiku-20240307' ? 'selected' : ''}>Claude 3 Haiku</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="s-ai-key">API Key</label>
                        <div class="input-with-icon">
                            <input type="password" id="s-ai-key" value="${escHtml(settings.ai_api_key || '')}" placeholder="sk-proj-…" autocomplete="new-password" />
                            <button type="button" class="pw-toggle" data-target="s-ai-key" tabindex="-1"><i class="fa-solid fa-eye"></i></button>
                        </div>
                        <span class="form-hint">Stored securely in your Supabase settings table.</span>
                    </div>
                    <div class="form-group">
                        <label for="s-ai-temp">Temperature: <span id="s-temp-val">${settings.ai_temperature || '0.7'}</span></label>
                        <input type="range" id="s-ai-temp" min="0" max="1" step="0.1"
                               value="${settings.ai_temperature || '0.7'}"
                               oninput="document.getElementById('s-temp-val').textContent = this.value" />
                        <span class="form-hint">Lower = more focused and deterministic. Higher = more creative.</span>
                    </div>
                    <div class="form-group">
                        <label for="s-ai-max-tokens">Max Tokens</label>
                        <input type="number" id="s-ai-max-tokens" value="${escHtml(settings.ai_max_tokens || '2000')}" min="100" max="8000" step="100" />
                    </div>
                </div>
            </div>

            <!-- Email Configuration -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i class="fa-solid fa-envelope"></i>
                    <span class="settings-section-title">Email Configuration</span>
                </div>
                <div class="settings-section-body">
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-from-name">From Name</label>
                            <input type="text" id="s-from-name" value="${escHtml(settings.email_from_name || '')}" placeholder="Scalz SEO" />
                        </div>
                        <div class="form-group">
                            <label for="s-from-email">From Email</label>
                            <input type="email" id="s-from-email" value="${escHtml(settings.email_from || '')}" placeholder="noreply@scalz.ai" />
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-smtp-host">SMTP Host</label>
                            <input type="text" id="s-smtp-host" value="${escHtml(settings.smtp_host || '')}" placeholder="smtp.gmail.com" />
                        </div>
                        <div class="form-group">
                            <label for="s-smtp-port">SMTP Port</label>
                            <input type="number" id="s-smtp-port" value="${escHtml(settings.smtp_port || '587')}" placeholder="587" />
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-smtp-user">SMTP Username</label>
                            <input type="text" id="s-smtp-user" value="${escHtml(settings.smtp_username || '')}" placeholder="your@email.com" autocomplete="off" />
                        </div>
                        <div class="form-group">
                            <label for="s-smtp-pass">SMTP Password</label>
                            <div class="input-with-icon">
                                <input type="password" id="s-smtp-pass" value="${escHtml(settings.smtp_password || '')}" placeholder="App password" autocomplete="new-password" />
                                <button type="button" class="pw-toggle" data-target="s-smtp-pass" tabindex="-1"><i class="fa-solid fa-eye"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Plugin Management -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i class="fa-solid fa-puzzle-piece"></i>
                    <span class="settings-section-title">Plugin Management</span>
                    <button class="btn btn-ghost btn-sm" style="margin-left:auto;" id="add-plugin-btn">
                        <i class="fa-solid fa-plus"></i> Add Plugin
                    </button>
                </div>
                <div class="settings-section-body" id="plugins-list">
                    ${renderPluginsList(plugins)}
                </div>
            </div>

            <!-- Defaults -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i class="fa-solid fa-sliders"></i>
                    <span class="settings-section-title">Automation Defaults</span>
                </div>
                <div class="settings-section-body">
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-blog-count">Blog Posts Per Run</label>
                            <input type="number" id="s-blog-count" value="${escHtml(settings.default_blog_count || '5')}" min="1" max="50" />
                        </div>
                        <div class="form-group">
                            <label for="s-heading-level">Heading Level</label>
                            <select id="s-heading-level">
                                <option value="h2" ${settings.default_heading_level === 'h2' || !settings.default_heading_level ? 'selected' : ''}>H2</option>
                                <option value="h3" ${settings.default_heading_level === 'h3' ? 'selected' : ''}>H3</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="toggle-wrapper">
                            <span class="toggle">
                                <input type="checkbox" id="s-auto-run" ${settings.auto_run_workflow === 'true' ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </span>
                            <span class="toggle-label">Auto-run workflow on new client onboarding</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="toggle-wrapper">
                            <span class="toggle">
                                <input type="checkbox" id="s-notify-email" ${settings.notify_on_complete === 'true' ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </span>
                            <span class="toggle-label">Send email notification when jobs complete</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        initPasswordToggles(area);

        // Add plugin button
        document.getElementById('add-plugin-btn').addEventListener('click', () => openPluginModal(null, async () => {
            const p = await fetchPluginFiles();
            document.getElementById('plugins-list').innerHTML = renderPluginsList(p);
            bindPluginDeleteButtons();
        }));

        bindPluginDeleteButtons();

        // Save settings
        document.getElementById('settings-save-btn').addEventListener('click', async () => {
            const btn = document.getElementById('settings-save-btn');
            setButtonLoading(btn, true);

            const newSettings = {
                ai_provider:         document.getElementById('s-ai-provider').value,
                ai_model:            document.getElementById('s-ai-model').value,
                ai_api_key:          document.getElementById('s-ai-key').value,
                ai_temperature:      document.getElementById('s-ai-temp').value,
                ai_max_tokens:       document.getElementById('s-ai-max-tokens').value,
                email_from_name:     document.getElementById('s-from-name').value.trim(),
                email_from:          document.getElementById('s-from-email').value.trim(),
                smtp_host:           document.getElementById('s-smtp-host').value.trim(),
                smtp_port:           document.getElementById('s-smtp-port').value,
                smtp_username:       document.getElementById('s-smtp-user').value.trim(),
                smtp_password:       document.getElementById('s-smtp-pass').value,
                default_blog_count:  document.getElementById('s-blog-count').value,
                default_heading_level: document.getElementById('s-heading-level').value,
                auto_run_workflow:   document.getElementById('s-auto-run').checked ? 'true' : 'false',
                notify_on_complete:  document.getElementById('s-notify-email').checked ? 'true' : 'false',
            };

            try {
                await upsertSettings(newSettings);
                showToast('success', 'Saved', 'Settings saved successfully.');
            } catch (err) {
                showToast('error', 'Error', err.message);
            }
            setButtonLoading(btn, false);
        });

    } catch (err) {
        showToast('error', 'Error', err.message);
    }
}

function renderPluginsList(plugins) {
    if (!plugins || plugins.length === 0) {
        return `<p class="text-muted" style="font-size:0.875rem;">No plugins configured. Add plugins to auto-install them on client sites.</p>`;
    }
    return plugins.map(p => `
        <div class="plugin-item" id="plugin-item-${escHtml(p.id)}">
            <div class="plugin-item-icon"><i class="fa-solid fa-puzzle-piece"></i></div>
            <div class="plugin-item-info">
                <div class="plugin-item-name">${escHtml(p.name || 'Unnamed Plugin')}</div>
                <div class="plugin-item-url">${escHtml(p.url || '—')}</div>
                ${p.license_key ? `<div style="font-size:0.75rem;color:var(--text-muted);">License: ${escHtml(truncate(p.license_key, 20))}</div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:var(--space-3);">
                ${p.auto_install !== false ? `<span class="badge badge-green">Auto-install</span>` : `<span class="badge badge-gray">Manual</span>`}
                <button class="btn-icon btn-icon-blue" title="Edit" onclick="editPlugin('${escHtml(p.id)}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon btn-icon-danger plugin-delete-btn" title="Delete" data-id="${escHtml(p.id)}" data-name="${escHtml(p.name || 'this plugin')}"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function bindPluginDeleteButtons() {
    document.querySelectorAll('.plugin-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id   = btn.dataset.id;
            const name = btn.dataset.name;
            showConfirm('Delete Plugin', `Remove "${name}" from the plugin list?`, async () => {
                try {
                    await deletePluginFile(id);
                    showToast('success', 'Deleted', `${name} removed.`);
                    const p = await fetchPluginFiles();
                    document.getElementById('plugins-list').innerHTML = renderPluginsList(p);
                    bindPluginDeleteButtons();
                } catch (err) {
                    showToast('error', 'Error', err.message);
                }
            }, 'Delete');
        });
    });
}

window.editPlugin = async function(id) {
    try {
        const { data: plugin, error } = await sb.from('plugin_files').select('*').eq('id', id).single();
        if (error) throw error;
        openPluginModal(plugin, async () => {
            const p = await fetchPluginFiles();
            document.getElementById('plugins-list').innerHTML = renderPluginsList(p);
            bindPluginDeleteButtons();
        });
    } catch (err) {
        showToast('error', 'Error', err.message);
    }
};

function openPluginModal(plugin, onSave) {
    const isEdit = !!plugin;
    openModal(isEdit ? 'Edit Plugin' : 'Add Plugin', `
        <div class="form-group">
            <label for="pm-name">Plugin Name <span class="required">*</span></label>
            <input type="text" id="pm-name" value="${escHtml(plugin?.name || '')}" placeholder="Rank Math SEO Pro" required />
        </div>
        <div class="form-group">
            <label for="pm-url">Download URL / Zip URL</label>
            <input type="url" id="pm-url" value="${escHtml(plugin?.url || '')}" placeholder="https://example.com/plugin.zip" />
        </div>
        <div class="form-group">
            <label for="pm-license">License Key</label>
            <div class="input-with-icon">
                <input type="password" id="pm-license" value="${escHtml(plugin?.license_key || '')}" placeholder="xxxx-xxxx-xxxx-xxxx" />
                <button type="button" class="pw-toggle" data-target="pm-license" tabindex="-1"><i class="fa-solid fa-eye"></i></button>
            </div>
        </div>
        <div class="form-group">
            <label class="toggle-wrapper">
                <span class="toggle">
                    <input type="checkbox" id="pm-auto" ${plugin?.auto_install !== false ? 'checked' : ''} />
                    <span class="toggle-slider"></span>
                </span>
                <span class="toggle-label">Auto-install on new client sites</span>
            </label>
        </div>
        <div class="form-group">
            <label for="pm-notes">Notes</label>
            <textarea id="pm-notes" rows="2" placeholder="Any notes about this plugin…">${escHtml(plugin?.notes || '')}</textarea>
        </div>
        <div class="modal-footer">
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" id="pm-save-btn">
                <span class="btn-text">${isEdit ? 'Save Changes' : 'Add Plugin'}</span>
                <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
            </button>
        </div>
    `);

    document.getElementById('pm-save-btn').addEventListener('click', async () => {
        const btn  = document.getElementById('pm-save-btn');
        const name = document.getElementById('pm-name').value.trim();
        if (!name) { showToast('warning', 'Required', 'Plugin name is required.'); return; }

        const data = {
            name,
            url:          document.getElementById('pm-url').value.trim() || null,
            license_key:  document.getElementById('pm-license').value || null,
            auto_install: document.getElementById('pm-auto').checked,
            notes:        document.getElementById('pm-notes').value.trim() || null,
        };

        setButtonLoading(btn, true);
        try {
            if (isEdit) {
                const { error } = await sb.from('plugin_files').update(data).eq('id', plugin.id);
                if (error) throw error;
            } else {
                await createPluginFile(data);
            }
            showToast('success', 'Saved', `${name} ${isEdit ? 'updated' : 'added'}.`);
            closeModal();
            if (onSave) await onSave();
        } catch (err) {
            showToast('error', 'Error', err.message);
            setButtonLoading(btn, false);
        }
    });
}

/* =============================================
   G. GLOBAL SEARCH
============================================= */
function setupGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value.trim().toLowerCase();
        if (!q) return;
        searchTimeout = setTimeout(async () => {
            try {
                const [clients, jobs] = await Promise.all([
                    sb.from('clients').select('id, business_name').ilike('business_name', `%${q}%`).limit(3),
                    sb.from('jobs').select('id, task_type, status').ilike('task_type', `%${q}%`).limit(3),
                ]);
                // Simple: navigate to clients if typing a name
                if (clients.data && clients.data.length > 0 && q.length >= 3) {
                    window.location.hash = '#clients';
                }
            } catch (e) { /* ignore */ }
        }, 500);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = searchInput.value.trim();
            if (q) window.location.hash = '#clients';
        }
    });
}

/* =============================================
   H. INITIALIZATION
============================================= */

// Modal close handlers
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// Confirm close
document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
document.getElementById('confirm-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('confirm-overlay')) closeConfirm();
});

// Hash routing
window.addEventListener('hashchange', handleRoute);

// Sidebar toggle (mobile)
const sidebarEl      = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const sidebarToggle  = document.getElementById('sidebar-toggle');
const sidebarClose   = document.getElementById('sidebar-close');

function openSidebar() {
    sidebarEl.classList.add('open');
    sidebarOverlay.classList.add('open');
}

function closeSidebar() {
    sidebarEl.classList.remove('open');
    sidebarOverlay.classList.remove('open');
}

if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
if (sidebarClose)  sidebarClose.addEventListener('click', closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

// Close sidebar on nav item click (mobile)
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 768) closeSidebar();
    });
});

// Password toggles for initial page
initPasswordToggles(document);

// Apply white-label branding
applyBranding();

// Auth forms
setupAuthForms();

// Global search
setupGlobalSearch();

// Initial auth check
(async function init() {
    const hash = window.location.hash;

    // Onboarding form doesn't need auth
    if (hash.startsWith('#onboard/')) {
        showOnboardingLayout();
        const token = hash.slice('#onboard/'.length);
        showOnboardingForm(token);
        return;
    }

    // For all other routes, check auth
    await checkSession();
})();

