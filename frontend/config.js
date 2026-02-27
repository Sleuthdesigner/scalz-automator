// ============================================
// SCALZ SEO AUTOMATOR — CONFIGURATION
// ============================================

// ---- SUPABASE CREDENTIALS ----
// Get these from: https://supabase.com/dashboard → Project → Settings → API
const SUPABASE_URL = 'https://bvbxyrgqdjctnbyilzjj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2Ynh5cmdxZGpjdG5ieWlsempqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTEzNjIsImV4cCI6MjA4Nzc4NzM2Mn0.LwLiIz4f0iUm3jVdV1vMm3A-oycUf3ZPgubvobjrTJg';

// ---- WHITE-LABEL BRANDING ----
// Customize these to white-label the dashboard for your agency
const BRANDING = {
    // Agency / Company name shown in sidebar, login page, and emails
    name: 'SEO Automator',
    
    // Short name for compact spaces (sidebar collapsed, mobile)
    shortName: 'SEO',
    
    // Accent portion of the name (rendered in the accent color)
    // e.g., if name is "Acme SEO" and accentText is "SEO", it renders as: Acme<accent>SEO</accent>
    accentText: 'Automator',
    
    // Logo icon (Font Awesome class) — used when no custom logo URL is set
    icon: 'fas fa-bolt',
    
    // Custom logo URL (optional — set to '' to use icon instead)
    // Recommended size: 32x32px or 40x40px PNG/SVG
    logoUrl: '',
    
    // Tagline shown on login page
    tagline: 'WordPress SEO Automation Platform',
    
    // Primary accent color (used for active nav items, buttons, links)
    accentColor: '#4f8fff',
    
    // Success color
    successColor: '#22c55e',
    
    // Onboarding form branding
    onboarding: {
        title: 'Client Onboarding',
        subtitle: 'Please fill out the form below to get started with your SEO automation.',
        successMessage: 'Your onboarding information has been submitted successfully. We\'ll begin setting up your SEO automation shortly.',
    },
    
    // Footer text (optional)
    footerText: '',
    
    // Help/Support URL (optional — adds a help link in sidebar)
    supportUrl: '',
};

// Workflow step definitions
const WORKFLOW_STEPS = [
    { id: 'install_plugins', name: 'Install Plugins & Apply Licenses', icon: 'fa-plug' },
    { id: 'page_titles', name: 'Generate Page Titles', icon: 'fa-heading' },
    { id: 'meta_descriptions', name: 'Optimize Meta Descriptions', icon: 'fa-file-alt' },
    { id: 'acf_content', name: 'Generate ACF Content', icon: 'fa-pen-fancy' },
    { id: 'alt_tags', name: 'Add Alt Tags to Images', icon: 'fa-image' },
    { id: 'internal_linking', name: 'Run Internal Linking', icon: 'fa-link' },
    { id: 'parse_sitemap', name: 'Parse Sitemap', icon: 'fa-sitemap' },
    { id: 'blog_titles', name: 'Generate Blog Titles', icon: 'fa-newspaper' },
    { id: 'blog_content', name: 'Generate Blog Content', icon: 'fa-blog' },
    { id: 'fix_headings', name: 'Fix Blog Headings (H2)', icon: 'fa-text-height' },
    { id: 'faq_schema', name: 'Add FAQ Schema', icon: 'fa-question-circle' },
];

// Template variables reference
const TEMPLATE_VARIABLES = [
    { var: '{title}', desc: 'Page or post title' },
    { var: '{location}', desc: 'Full location (City, State)' },
    { var: '{city}', desc: 'City name' },
    { var: '{state}', desc: 'State name' },
    { var: '{state_abbr}', desc: 'State abbreviation' },
    { var: '{business_name}', desc: 'Business name' },
    { var: '{service}', desc: 'Service name' },
    { var: '{niche}', desc: 'Business niche' },
    { var: '{phone}', desc: 'Business phone' },
    { var: '{address}', desc: 'Business address' },
    { var: '{existing_content}', desc: 'Current page content' },
    { var: '{existing_titles}', desc: 'Existing blog titles (from sitemap)' },
    { var: '{focus_keyword}', desc: 'Target SEO keyword' },
    { var: '{count}', desc: 'Number of items to generate' },
];
