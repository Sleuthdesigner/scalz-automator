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

async function fetchJobs(filters = {}) {
    let query = sb
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
    const { data, error } = await sb
        .from('jobs')
        .select('*, clients(business_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data || [];
}

async function fetchRecentClients(limit = 5) {
    const { data, error } = await sb
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data || [];
}

function subscribeToJobs(onUpdate) {
    unsubscribeRealtime();
    realtimeChannel = sb
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
