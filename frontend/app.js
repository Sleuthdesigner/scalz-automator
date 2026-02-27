/* =============================================
   SCALZ SEO AUTOMATOR — app.js
   Main application logic
   Connects to Supabase for all data operations
============================================= */

// In-memory store (replaces sessionStorage which is unavailable in sandboxed iframes)
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
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App state
let currentPage = null;
let currentUser = null;
let realtimeChannel = null;
let workflowEnabledSteps = new Set(WORKFLOW_STEPS.map(s => s.id));
let clientsCache = [];
let jobsSubscription = null;