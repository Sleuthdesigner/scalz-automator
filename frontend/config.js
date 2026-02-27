/* =============================================
   SCALZ SEO AUTOMATOR — config.js
============================================= */

const SUPABASE_URL     = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const BRANDING = {
    appName     : 'SEO Automator',
    accentText  : 'Automator',
    tagline     : 'WordPress SEO Automation Platform',
    icon        : 'fas fa-bolt',
    logoUrl     : '',
    accentColor : '#4f8fff',
    successColor: '#22c55e',
    footerText  : '',
    supportUrl  : '',
};

const WORKFLOW_STEPS = [
    { id: 'page_titles',    label: 'Page Titles',        icon: 'fas fa-heading',       endpoint: '/seo/titles' },
    { id: 'meta_desc',      label: 'Meta Descriptions',  icon: 'fas fa-align-left',    endpoint: '/seo/descriptions' },
    { id: 'focus_kw',       label: 'Focus Keywords',     icon: 'fas fa-key',           endpoint: '/seo/focus-keywords' },
    { id: 'alt_tags',       label: 'Alt Tags',           icon: 'fas fa-image',         endpoint: '/seo/alt-tags' },
    { id: 'acf_content',    label: 'ACF Content',        icon: 'fas fa-file-code',     endpoint: '/content/acf' },
    { id: 'h2_headings',    label: 'H2 Headings',        icon: 'fas fa-list',          endpoint: '/content/h2' },
    { id: 'faq_schema',     label: 'FAQ Schema',         icon: 'fas fa-circle-question', endpoint: '/schema/faq' },
];
