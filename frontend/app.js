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
let currentUserRole = 'user';
let realtimeChannel = null;
let workflowEnabledSteps = new Set(WORKFLOW_STEPS.map(s => s.id));
let clientsCache = [];
let jobsSubscription = null;

// Credit system config
const CREDIT_PACKAGES = {
    starter: {
        name: 'Starter Pack',
        credits: 1000,
        price: '$29',
        price_cents: 2900,
        per_credit: '$0.029',
        savings: null,
        icon: 'fa-bolt',
        color: '#13e4e6',
    },
    growth: {
        name: 'Growth Pack',
        credits: 5000,
        price: '$79',
        price_cents: 7900,
        per_credit: '$0.016',
        savings: '45% savings',
        icon: 'fa-rocket',
        color: '#6600FF',
        popular: true,
    },
    agency: {
        name: 'Agency Pack',
        credits: 15000,
        price: '$149',
        price_cents: 14900,
        per_credit: '$0.010',
        savings: '66% savings',
        icon: 'fa-building',
        color: '#A01572',
    },
    enterprise: {
        name: 'Enterprise Pack',
        credits: 50000,
        price: '$399',
        price_cents: 39900,
        per_credit: '$0.008',
        savings: '72% savings',
        icon: 'fa-crown',
        color: '#f59e0b',
    },
};

// ============================================
// AI MODEL REGISTRY — All providers + pricing
// Credits = 2× your actual API cost
// 1 credit ≈ $0.001 sale price ($0.0005 cost)
// ============================================
const AI_MODELS = {
    // ---- OpenAI ----
    'gpt-5':            { provider: 'openai',    name: 'GPT-5',                 input: 1.25,  output: 10.00, ctx: '400K', tier: 'premium',  creditsPerKToken: 10 },
    'gpt-5-mini':       { provider: 'openai',    name: 'GPT-5 Mini',            input: 0.25,  output: 2.00,  ctx: '400K', tier: 'standard', creditsPerKToken: 2 },
    'gpt-5-nano':       { provider: 'openai',    name: 'GPT-5 Nano',            input: 0.05,  output: 0.40,  ctx: '400K', tier: 'economy',  creditsPerKToken: 1 },
    'gpt-4.1':          { provider: 'openai',    name: 'GPT-4.1',               input: 2.00,  output: 8.00,  ctx: '1M',   tier: 'premium',  creditsPerKToken: 9 },
    'gpt-4.1-mini':     { provider: 'openai',    name: 'GPT-4.1 Mini',          input: 0.40,  output: 1.60,  ctx: '1M',   tier: 'standard', creditsPerKToken: 2 },
    'gpt-4.1-nano':     { provider: 'openai',    name: 'GPT-4.1 Nano',          input: 0.10,  output: 0.40,  ctx: '1M',   tier: 'economy',  creditsPerKToken: 1 },
    'gpt-4o':           { provider: 'openai',    name: 'GPT-4o',                input: 2.50,  output: 10.00, ctx: '128K', tier: 'premium',  creditsPerKToken: 11 },
    'gpt-4o-mini':      { provider: 'openai',    name: 'GPT-4o Mini',           input: 0.15,  output: 0.60,  ctx: '128K', tier: 'economy',  creditsPerKToken: 1 },
    'o4-mini':          { provider: 'openai',    name: 'o4 Mini (Reasoning)',    input: 1.10,  output: 4.40,  ctx: '200K', tier: 'standard', creditsPerKToken: 5 },
    'o3':               { provider: 'openai',    name: 'o3 (Reasoning)',         input: 2.00,  output: 8.00,  ctx: '200K', tier: 'premium',  creditsPerKToken: 9 },
    'o3-mini':          { provider: 'openai',    name: 'o3 Mini (Reasoning)',    input: 1.10,  output: 4.40,  ctx: '200K', tier: 'standard', creditsPerKToken: 5 },
    // ---- Anthropic ----
    'claude-opus-4.6':  { provider: 'anthropic',  name: 'Claude Opus 4.6',       input: 5.00,  output: 25.00, ctx: '1M',   tier: 'ultra',    creditsPerKToken: 26 },
    'claude-sonnet-4.6':{ provider: 'anthropic',  name: 'Claude Sonnet 4.6',     input: 3.00,  output: 15.00, ctx: '1M',   tier: 'premium',  creditsPerKToken: 16 },
    'claude-sonnet-4.5':{ provider: 'anthropic',  name: 'Claude Sonnet 4.5',     input: 3.00,  output: 15.00, ctx: '1M',   tier: 'premium',  creditsPerKToken: 16 },
    'claude-opus-4.5':  { provider: 'anthropic',  name: 'Claude Opus 4.5',       input: 5.00,  output: 25.00, ctx: '200K', tier: 'ultra',    creditsPerKToken: 26 },
    'claude-haiku-4.5': { provider: 'anthropic',  name: 'Claude Haiku 4.5',      input: 1.00,  output: 5.00,  ctx: '200K', tier: 'standard', creditsPerKToken: 6 },
    'claude-haiku-3.5': { provider: 'anthropic',  name: 'Claude 3.5 Haiku',      input: 0.80,  output: 4.00,  ctx: '200K', tier: 'standard', creditsPerKToken: 5 },
    // ---- Google ----
    'gemini-2.5-pro':   { provider: 'google',    name: 'Gemini 2.5 Pro',         input: 1.25,  output: 10.00, ctx: '2M',   tier: 'premium',  creditsPerKToken: 10 },
    'gemini-2.5-flash': { provider: 'google',    name: 'Gemini 2.5 Flash',       input: 0.15,  output: 0.60,  ctx: '1M',   tier: 'economy',  creditsPerKToken: 1 },
    'gemini-2.0-flash': { provider: 'google',    name: 'Gemini 2.0 Flash',       input: 0.10,  output: 0.40,  ctx: '1M',   tier: 'economy',  creditsPerKToken: 1 },
    // ---- AI Engine (Meow Apps WP Plugin) ----
    'ai-engine':        { provider: 'ai-engine', name: 'AI Engine (WP Plugin)',   input: 0,     output: 0,     ctx: 'Varies', tier: 'standard', creditsPerKToken: 5 },
};

// Base credit costs per task type (at economy tier)
// Actual cost = base × model multiplier
const CREDIT_COSTS = {
    page_titles: 5,
    meta_descriptions: 8,
    blog_titles: 10,
    blog_content: 60,
    acf_content: 25,
    alt_tags: 15,
    fix_headings: 10,
    faq_schema: 15,
    ai_image: 25,
    internal_linking: 5,
    install_plugins: 0,
    parse_sitemap: 0,
};

// Tier multipliers — economy models use 1x, premium use more
const TIER_MULTIPLIERS = {
    economy: 1.0,
    standard: 1.5,
    premium: 3.0,
    ultra: 5.0,
};

// Get effective credit cost for a task based on selected model
function getEffectiveCreditCost(taskType, modelId) {
    const baseCost = CREDIT_COSTS[taskType] || 0;
    if (baseCost === 0) return 0;
    const model = AI_MODELS[modelId];
    const multiplier = model ? (TIER_MULTIPLIERS[model.tier] || 1) : 1;
    return Math.ceil(baseCost * multiplier);
}

let userCredits = { balance: 0, lifetime_purchased: 0, lifetime_used: 0 };

// ============================================
// PRE-BUILT PRODUCTION SEO PROMPT TEMPLATES
// ============================================
const DEFAULT_PROMPT_TEMPLATES = [
    {
        name: 'Install Plugins & Apply Licenses',
        category: 'install_plugins',
        prompt: `You are a WordPress site configuration assistant. For the client site {business_name} ({site_url}):

1. Verify the following required plugins are installed and activated:
   - RankMath SEO (or the configured SEO plugin)
   - Advanced Custom Fields PRO
   - Scalz SEO Automator Plugin

2. Apply any provided license keys to premium plugins.

3. Confirm all plugins are up to date and compatible.

Business: {business_name}
Niche: {niche}
Location: {city}, {state}

Report the status of each plugin installation.`
    },
    {
        name: 'Generate Page Titles',
        category: 'page_titles',
        prompt: `You are an expert SEO and AEO (Answer Engine Optimization) specialist. Generate an optimized page title for the following page.

**Business:** {business_name}
**Service:** {service}
**City:** {city}
**State:** {state} ({state_abbr})
**Current Title:** {title}
**Niche:** {niche}

**Requirements:**
- Include the primary service keyword naturally
- Include the city/location for local SEO
- Include the business name (brand)
- Keep under 60 characters for SERP display
- Use separator format: Primary Keyword in City | Business Name
- Make it compelling and click-worthy

**Format:** Return ONLY the optimized title text, no explanation.

**Example:** Roof Replacement in Dallas, TX | Acme Roofing Co.`
    },
    {
        name: 'Optimize Meta Descriptions',
        category: 'meta_descriptions',
        prompt: `You are an expert SEO copywriter. Write an optimized meta description for the following page.

**Business:** {business_name}
**Service:** {service}
**City:** {city}, {state}
**Phone:** {phone}
**Niche:** {niche}
**Page Title:** {title}

**Requirements:**
- Keep between 150-160 characters (hard limit)
- Include primary service keyword in first 60 characters
- Include city/location for local SEO relevance
- Include a clear call-to-action (Call today, Get a free quote, etc.)
- Include phone number if space allows
- Write in active voice, be compelling
- Do NOT use generic filler phrases
- Optimize for both click-through AND AI answer extraction (AEO)

**Format:** Return ONLY the meta description text, no explanation or character count.`
    },
    {
        name: 'Generate ACF Content',
        category: 'acf_content',
        prompt: `You are an expert SEO and AEO content writer specializing in local service businesses. Write comprehensive content for an ACF (Advanced Custom Fields) content area on a service page.

**Business:** {business_name}
**Service:** {service}
**Location:** {city}, {state} {state_abbr}
**Address:** {address}
**Phone:** {phone}
**Niche:** {niche}
**Page Title:** {title}

**Content Requirements:**
- Write 600-1000 words of SEO and AEO optimized content
- Start with a compelling introduction that names the service AND location in the first sentence
- Use H2 and H3 subheadings naturally (include keywords in headings)
- Answer the top 3-5 questions people ask about this service in this area (AEO optimization)
- Include local relevance: mention neighborhoods, nearby landmarks, or regional specifics
- Include a "Why Choose {business_name}" section
- Mention the service area / location multiple times naturally
- Include a strong CTA paragraph at the end with phone number
- Use short paragraphs (2-3 sentences max)
- Write in a professional but approachable tone
- Include semantic LSI keywords related to {service}
- Structure content so AI assistants can extract direct answers

**Format:** Return HTML-formatted content with proper heading tags (h2, h3), paragraphs (p), and lists (ul/li) where appropriate. Do NOT include h1 tags.`
    },
    {
        name: 'Add Alt Tags to Images',
        category: 'alt_tags',
        prompt: `You are an SEO specialist focused on image optimization. Generate a descriptive, keyword-rich alt tag for an image.

**Business:** {business_name}
**Service:** {service}
**City:** {city}, {state_abbr}
**Page Title:** {title}
**Niche:** {niche}

**Requirements:**
- Be specific and descriptive (what the image actually shows)
- Include the primary service keyword naturally
- Include location when relevant (city, state abbreviation)
- Keep under 125 characters
- Do NOT start with "image of" or "picture of"
- Do NOT keyword stuff — keep it natural
- Make it useful for visually impaired users (accessibility)

**Format:** Return ONLY the alt tag text, nothing else.

**Examples:**
- Professional roof replacement crew installing new shingles on a Dallas TX home
- Licensed HVAC technician servicing a commercial air conditioning unit in Austin
- Emergency plumber repairing a burst pipe in a Houston residential kitchen`
    },
    {
        name: 'Run Internal Linking',
        category: 'internal_linking',
        prompt: `You are an SEO internal linking strategist. Analyze the following page content and suggest internal links to other pages on the site.

**Business:** {business_name}
**Current Page:** {title}
**Service:** {service}
**Existing Content:** {existing_content}

**Requirements:**
- Identify 3-5 natural anchor text opportunities within the existing content
- Link to relevant service pages, location pages, or blog posts on the same site
- Use descriptive, keyword-rich anchor text (not "click here" or "learn more")
- Prioritize linking to pages that share topical relevance
- Ensure links support the site's SEO silo structure
- Avoid over-linking (no more than 1 internal link per 200 words)

**Format:** Return a JSON array of link suggestions:
[{
  "anchor_text": "roof replacement services",
  "target_page": "/services/roof-replacement/",
  "context": "The sentence where this link should be inserted",
  "reason": "Why this link is relevant"
}]`
    },
    {
        name: 'Parse Sitemap',
        category: 'parse_sitemap',
        prompt: `You are a WordPress site analyst. Parse the sitemap for {business_name} ({site_url}) and categorize all discovered URLs.

**Requirements:**
- Identify all page URLs and categorize them (service pages, location pages, blog posts, etc.)
- Note pages that are missing meta descriptions or have thin content
- Identify orphan pages (pages not linked from any other page)
- Flag duplicate or near-duplicate content
- Provide a summary of the site structure

**Format:** Return a structured analysis with categories and page counts.`
    },
    {
        name: 'Generate Blog Titles',
        category: 'blog_titles',
        prompt: `You are an expert SEO content strategist specializing in local service businesses. Generate {count} unique, SEO-optimized blog post titles.

**Business:** {business_name}
**Niche:** {niche}
**Location:** {city}, {state}
**Primary Services:** {service}

**Existing Blog Titles (DO NOT duplicate):**
{existing_titles}

**Requirements:**
- Each title must be unique and not duplicate existing titles above
- Include location (city or state) in at least 60% of titles
- Include primary service keywords naturally
- Mix title formats: How-to, Lists (Top 5, 7 Signs), Questions, Guides
- Target long-tail keywords for realistic ranking potential
- Keep titles under 65 characters for SERP display
- Focus on topics that demonstrate local expertise and E-E-A-T
- Include seasonal/timely topics relevant to the niche and location
- Target questions people actually ask (AEO optimization)

**Format:** Return a numbered list of titles, one per line. No descriptions or explanations.

**Example titles for a roofing company in Dallas:**
1. 7 Signs You Need a Roof Replacement in Dallas TX
2. How Much Does Roof Repair Cost in North Texas?
3. Best Roofing Materials for Dallas Heat and Hailstorms
4. When to File a Roof Insurance Claim After a Dallas Storm`
    },
    {
        name: 'Generate Blog Content',
        category: 'blog_content',
        prompt: `You are an expert SEO and AEO content writer. Write a comprehensive, publish-ready blog post.

**Business:** {business_name}
**Blog Title:** {title}
**Focus Keyword:** {focus_keyword}
**Location:** {city}, {state}
**Niche:** {niche}
**Phone:** {phone}

**Content Requirements:**
- Length: {word_count_min}-{word_count_max} words
- Use {focus_keyword} in the first paragraph, one H2, and naturally throughout (1-2% density)
- Include {city}, {state} references naturally throughout (local SEO)
- Structure with exactly {sections_count} H2 subheadings throughout the post
- Each section should contain {paragraphs_per_section} paragraphs of 2-3 sentences each
- Use H3 subheadings within sections where appropriate
{image_instructions}
- Write an engaging introduction (hook → problem → preview of solution)
- Include actionable, expert-level advice (demonstrate E-E-A-T)
- Add a FAQ section with 4-5 questions in FAQ schema-ready format
- Each FAQ answer should be 2-3 sentences (optimized for AI answer extraction)
- Include statistics or data points where relevant
- Use short paragraphs (2-3 sentences max)
- Include bulleted or numbered lists where appropriate
- Write a strong conclusion with CTA mentioning {business_name} and {phone}
- Tone: Professional, authoritative, but approachable
- Do NOT include meta descriptions, tags, or categories — just the content

**Format:** Return HTML-formatted content with proper h2, h3, p, ul/li tags. Include a clearly marked FAQ section at the end formatted as:
<h2>Frequently Asked Questions</h2>
<h3>Question here?</h3>
<p>Answer here.</p>`
    },
    {
        name: 'Fix Blog Headings (H2)',
        category: 'fix_headings',
        prompt: `You are an SEO content editor. Review and optimize the heading structure of the following blog post content.

**Business:** {business_name}
**Post Title (H1):** {title}
**Focus Keyword:** {focus_keyword}
**Existing Content:** {existing_content}

**Requirements:**
- Ensure all subheadings use H2 tags (not H3, H4, or bold text acting as headings)
- Include the focus keyword in at least one H2 subheading
- Include a location reference in at least one H2 where natural
- Ensure headings follow a logical hierarchy (H2 → H3 where needed)
- Make headings descriptive and keyword-rich (not vague like "More Info")
- Keep heading count appropriate (1 H2 per 250-300 words)
- Each H2 should accurately describe the content that follows it

**Format:** Return the corrected content with properly structured heading tags. Only modify headings — do not change paragraph content.`
    },
    {
        name: 'Add FAQ Schema',
        category: 'faq_schema',
        prompt: `You are an SEO and AEO (Answer Engine Optimization) specialist. Generate FAQ schema content for a page.

**Business:** {business_name}
**Service:** {service}
**Location:** {city}, {state}
**Page Title:** {title}
**Niche:** {niche}
**Phone:** {phone}

**Requirements:**
- Generate 5-7 FAQ questions and answers
- Questions should be ones real people actually search for (use "People Also Ask" style)
- Each answer should be 2-3 sentences — concise enough for featured snippets
- Include the service keyword and location naturally in answers
- Include {business_name} mention in 1-2 answers
- Include a CTA with phone number in the last answer
- Optimize answers for AI assistant extraction (AEO) — direct, factual, complete
- Cover these angles: cost/pricing, process, timeline, qualifications, comparisons

**Format:** Return a valid JSON array for FAQ schema markup:
[
  {
    "question": "How much does {service} cost in {city}?",
    "answer": "The cost of {service} in {city} typically ranges from $X to $Y depending on..."
  }
]`
    }
];

// ============================================
// COMMON ACF FIELD PRESETS
// ============================================
const COMMON_ACF_FIELDS = [
    // Content fields
    { name: 'hero_heading', label: 'Hero Heading', type: 'text', group: 'Hero Section', description: 'Main H1 heading in the hero/banner area' },
    { name: 'hero_subheading', label: 'Hero Subheading', type: 'text', group: 'Hero Section', description: 'Subtitle text below the hero heading' },
    { name: 'hero_cta_text', label: 'Hero CTA Button Text', type: 'text', group: 'Hero Section', description: 'Call-to-action button text' },
    { name: 'hero_cta_link', label: 'Hero CTA Link', type: 'url', group: 'Hero Section', description: 'CTA button destination URL' },
    { name: 'hero_image', label: 'Hero Background Image', type: 'image', group: 'Hero Section', description: 'Hero/banner background image' },
    // Main content
    { name: 'main_content', label: 'Main Content', type: 'wysiwyg', group: 'Page Content', description: 'Primary page content area (WYSIWYG editor)' },
    { name: 'intro_text', label: 'Introduction Text', type: 'wysiwyg', group: 'Page Content', description: 'Introductory paragraph before main content' },
    { name: 'content_area_1', label: 'Content Area 1', type: 'wysiwyg', group: 'Page Content', description: 'First flexible content block' },
    { name: 'content_area_2', label: 'Content Area 2', type: 'wysiwyg', group: 'Page Content', description: 'Second flexible content block' },
    { name: 'bottom_content', label: 'Bottom Content', type: 'wysiwyg', group: 'Page Content', description: 'Content area below main content (above footer)' },
    // Service-specific
    { name: 'service_description', label: 'Service Description', type: 'wysiwyg', group: 'Service Details', description: 'Detailed description of the service' },
    { name: 'service_benefits', label: 'Service Benefits', type: 'wysiwyg', group: 'Service Details', description: 'List of benefits / why choose this service' },
    { name: 'service_process', label: 'Service Process', type: 'wysiwyg', group: 'Service Details', description: 'Step-by-step process description' },
    { name: 'service_pricing', label: 'Service Pricing Info', type: 'wysiwyg', group: 'Service Details', description: 'Pricing information or ranges' },
    { name: 'service_area', label: 'Service Area', type: 'wysiwyg', group: 'Service Details', description: 'Geographic service area description' },
    // Testimonials / Social Proof
    { name: 'testimonials', label: 'Testimonials', type: 'repeater', group: 'Social Proof', description: 'Customer testimonials repeater field' },
    { name: 'reviews_text', label: 'Reviews Section Text', type: 'wysiwyg', group: 'Social Proof', description: 'Text content for reviews section' },
    // FAQ
    { name: 'faq_section', label: 'FAQ Section', type: 'repeater', group: 'FAQ', description: 'FAQ repeater with question/answer pairs' },
    { name: 'faq_intro', label: 'FAQ Introduction', type: 'wysiwyg', group: 'FAQ', description: 'Introductory text above FAQ section' },
    // CTA / Contact
    { name: 'cta_heading', label: 'CTA Heading', type: 'text', group: 'Call to Action', description: 'Call-to-action section heading' },
    { name: 'cta_text', label: 'CTA Description', type: 'textarea', group: 'Call to Action', description: 'CTA section description text' },
    { name: 'cta_button_text', label: 'CTA Button Text', type: 'text', group: 'Call to Action', description: 'CTA button label' },
    { name: 'cta_phone', label: 'CTA Phone Number', type: 'text', group: 'Call to Action', description: 'Phone number displayed in CTA' },
    // Location / Map
    { name: 'location_description', label: 'Location Description', type: 'wysiwyg', group: 'Location', description: 'Local area description for location pages' },
    { name: 'areas_served', label: 'Areas Served', type: 'wysiwyg', group: 'Location', description: 'List of neighborhoods/cities served' },
    { name: 'google_map_embed', label: 'Google Map Embed', type: 'textarea', group: 'Location', description: 'Google Maps embed code' },
    // SEO
    { name: 'seo_content', label: 'SEO Content Block', type: 'wysiwyg', group: 'SEO', description: 'Additional SEO content block (often hidden or below fold)' },
    { name: 'schema_data', label: 'Schema Markup', type: 'textarea', group: 'SEO', description: 'Custom JSON-LD schema markup' },
];

const SCALZ_PLUGIN = {
    name: 'Scalz SEO Automator',
    version: '1.0.0',
    downloadUrl: window.location.origin + '/scalz-seo-automator.zip',
    filename: 'scalz-seo-automator.zip',
};

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

async function showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('onboarding-page').style.display = 'none';
    await updateSidebarUser();
    fetchUserCredits();
    handleRoute();
}

function showOnboardingLayout() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('onboarding-page').style.display = 'block';
}

async function updateSidebarUser() {
    if (!currentUser) return;
    const email = currentUser.email || '';
    const initials = email ? email[0].toUpperCase() : 'U';
    document.getElementById('sidebar-user-email').textContent = email;
    document.getElementById('sidebar-user-avatar').textContent = initials;

    // Fetch role from profiles table
    try {
        const { data: profile } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
        const role = profile?.role || 'user';
        currentUserRole = role;
        const roleLabel = role === 'admin' ? 'Administrator' : 'User';
        document.getElementById('sidebar-user-role').textContent = roleLabel;
    } catch (e) {
        currentUserRole = 'user';
        document.getElementById('sidebar-user-role').textContent = 'User';
    }
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
            // Check if this is first login (no settings configured yet)
            try {
                const firstLoginCheck = await fetchSettings();
                if (!firstLoginCheck.email_from_name && !firstLoginCheck.smtp_host) {
                    showFirstTimeSetupModal();
                }
            } catch (_) {}
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

function showFirstTimeSetupModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'first-time-setup-overlay';
    overlay.innerHTML = `
        <div class="modal" style="max-width:560px;">
            <div class="modal-header">
                <span class="modal-title" style="display:flex;align-items:center;gap:var(--space-3);">
                    <span style="font-size:1.5rem;">🚀</span> Welcome! Let's Set Up Your Account
                </span>
            </div>
            <div class="modal-body" style="gap:var(--space-5);">
                <p style="color:var(--text-secondary);font-size:0.9rem;">Before you can send onboarding emails to clients, we need a few details.</p>

                <div style="font-weight:600;font-size:0.95rem;color:var(--text-primary);margin-top:var(--space-2);">Your Information</div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="fts-company">Company / Agency Name <span class="required">*</span></label>
                        <input type="text" id="fts-company" placeholder="Acme Digital Marketing" required />
                    </div>
                    <div class="form-group">
                        <label for="fts-name">Your Name <span class="required">*</span></label>
                        <input type="text" id="fts-name" placeholder="John Smith" required />
                    </div>
                </div>

                <div style="font-weight:600;font-size:0.95rem;color:var(--text-primary);margin-top:var(--space-2);">Email Sending</div>
                <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--space-3);">Onboarding emails will be sent from this address to your clients.</p>
                <div class="form-row">
                    <div class="form-group">
                        <label for="fts-from-name">From Name</label>
                        <input type="text" id="fts-from-name" placeholder="Your Company Name" />
                    </div>
                    <div class="form-group">
                        <label for="fts-from-email">From Email</label>
                        <input type="email" id="fts-from-email" placeholder="hello@yourcompany.com" />
                    </div>
                </div>

                <div style="font-weight:600;font-size:0.95rem;color:var(--text-primary);margin-top:var(--space-2);">SMTP Configuration</div>
                <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--space-3);">Select your email provider below or choose Custom to enter your own SMTP settings.</p>

                <div class="form-group" style="margin-bottom:var(--space-3);">
                    <label for="fts-smtp-provider">Email Provider</label>
                    <select id="fts-smtp-provider">
                        <option value="">Select a provider…</option>
                        <option value="gmail">Gmail / Google Workspace</option>
                        <option value="outlook">Outlook / Microsoft 365</option>
                        <option value="sendgrid">SendGrid</option>
                        <option value="mailgun">Mailgun</option>
                        <option value="ses">Amazon SES</option>
                        <option value="zoho">Zoho Mail</option>
                        <option value="custom">Custom SMTP</option>
                    </select>
                </div>

                <div id="fts-smtp-guide" style="display:none;padding:var(--space-3);background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:var(--space-4);font-size:0.82rem;color:var(--text-secondary);line-height:1.6;"></div>

                <div id="fts-own-smtp" style="display:none;">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="fts-smtp-host">SMTP Host <span class="required">*</span></label>
                            <input type="text" id="fts-smtp-host" placeholder="smtp.gmail.com" />
                        </div>
                        <div class="form-group">
                            <label for="fts-smtp-port">Port</label>
                            <input type="number" id="fts-smtp-port" value="587" placeholder="587" min="1" max="65535" />
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="fts-smtp-user">SMTP Username <span class="required">*</span></label>
                            <input type="text" id="fts-smtp-user" placeholder="your@email.com" autocomplete="off" />
                        </div>
                        <div class="form-group">
                            <label for="fts-smtp-pass">SMTP Password <span class="required">*</span></label>
                            <div class="input-with-icon">
                                <input type="password" id="fts-smtp-pass" placeholder="App password" autocomplete="new-password" />
                                <button type="button" class="pw-toggle" data-target="fts-smtp-pass" tabindex="-1"><i class="fa-solid fa-eye"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" id="fts-skip-btn">Skip for Now</button>
                <button class="btn btn-primary" id="fts-save-btn">
                    <span class="btn-text"><i class="fa-solid fa-check"></i> Complete Setup</span>
                    <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    // SMTP Provider Presets
    const SMTP_PRESETS = {
        gmail: {
            host: 'smtp.gmail.com', port: '587',
            guide: '<strong><i class="fa-solid fa-envelope"></i> Gmail / Google Workspace Setup</strong><br><br>' +
                '1. Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener">Google Account Security</a><br>' +
                '2. Enable <strong>2-Step Verification</strong> if not already on<br>' +
                '3. Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener">App Passwords</a><br>' +
                '4. Create a new app password (select "Mail" and your device)<br>' +
                '5. Copy the 16-character password Google gives you<br><br>' +
                '<strong>Username:</strong> your full Gmail address (you@gmail.com)<br>' +
                '<strong>Password:</strong> the 16-char app password (NOT your Google password)'
        },
        outlook: {
            host: 'smtp.office365.com', port: '587',
            guide: '<strong><i class="fa-solid fa-envelope"></i> Outlook / Microsoft 365 Setup</strong><br><br>' +
                '1. Sign in to <a href="https://account.microsoft.com/security" target="_blank" rel="noopener">Microsoft Account Security</a><br>' +
                '2. Enable <strong>Two-step verification</strong><br>' +
                '3. Under "App passwords", click <strong>Create a new app password</strong><br>' +
                '4. Copy the generated password<br><br>' +
                '<strong>Username:</strong> your full Outlook/365 email address<br>' +
                '<strong>Password:</strong> the app password (NOT your Microsoft password)<br>' +
                '<strong>Note:</strong> Some Microsoft 365 orgs disable SMTP AUTH. Ask your admin to enable it at <em>Exchange Admin → Settings → Mail flow</em>.'
        },
        sendgrid: {
            host: 'smtp.sendgrid.net', port: '587',
            guide: '<strong><i class="fa-solid fa-paper-plane"></i> SendGrid Setup</strong><br><br>' +
                '1. Sign up at <a href="https://signup.sendgrid.com/" target="_blank" rel="noopener">sendgrid.com</a> (free tier: 100 emails/day)<br>' +
                '2. Go to <strong>Settings → API Keys</strong><br>' +
                '3. Click <strong>Create API Key</strong> → choose "Full Access" or "Restricted Access" with Mail Send enabled<br>' +
                '4. Copy the API key<br>' +
                '5. Go to <strong>Settings → Sender Authentication</strong> and verify your domain or a single sender email<br><br>' +
                '<strong>Username:</strong> <code>apikey</code> (literally the word "apikey")<br>' +
                '<strong>Password:</strong> your SendGrid API key (starts with SG.)'
        },
        mailgun: {
            host: 'smtp.mailgun.org', port: '587',
            guide: '<strong><i class="fa-solid fa-paper-plane"></i> Mailgun Setup</strong><br><br>' +
                '1. Sign up at <a href="https://www.mailgun.com/" target="_blank" rel="noopener">mailgun.com</a> (free: 5,000 emails/mo for 3 months)<br>' +
                '2. Add and verify your sending domain under <strong>Sending → Domains</strong><br>' +
                '3. Go to <strong>Sending → Domain settings → SMTP credentials</strong><br>' +
                '4. Your default SMTP login is <code>postmaster@yourdomain.com</code><br>' +
                '5. Reset or create a password for that user<br><br>' +
                '<strong>Username:</strong> <code>postmaster@yourdomain.com</code><br>' +
                '<strong>Password:</strong> the SMTP password you set in Mailgun'
        },
        ses: {
            host: 'email-smtp.us-east-1.amazonaws.com', port: '587',
            guide: '<strong><i class="fa-brands fa-aws"></i> Amazon SES Setup</strong><br><br>' +
                '1. Open the <a href="https://console.aws.amazon.com/ses/" target="_blank" rel="noopener">Amazon SES Console</a><br>' +
                '2. Verify your sending domain or email under <strong>Verified identities</strong><br>' +
                '3. If in sandbox mode, you can only send to verified emails — <a href="https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html" target="_blank" rel="noopener">request production access</a> to send to anyone<br>' +
                '4. Go to <strong>SMTP settings</strong> → click <strong>Create SMTP credentials</strong><br>' +
                '5. An IAM user will be created — download the credentials<br><br>' +
                '<strong>Host:</strong> change the region in the host if needed (e.g., <code>email-smtp.eu-west-1.amazonaws.com</code>)<br>' +
                '<strong>Username:</strong> the SMTP username from IAM (starts with AKIA…)<br>' +
                '<strong>Password:</strong> the SMTP password (NOT the IAM secret key)'
        },
        zoho: {
            host: 'smtp.zoho.com', port: '587',
            guide: '<strong><i class="fa-solid fa-envelope"></i> Zoho Mail Setup</strong><br><br>' +
                '1. Sign in to <a href="https://accounts.zoho.com/home" target="_blank" rel="noopener">Zoho Accounts</a><br>' +
                '2. Go to <strong>Security → App Passwords</strong><br>' +
                '3. Click <strong>Generate New Password</strong> (name it "SCALZ SEO" or similar)<br>' +
                '4. Copy the generated app password<br><br>' +
                '<strong>Username:</strong> your full Zoho email (you@yourdomain.com)<br>' +
                '<strong>Password:</strong> the app password you generated<br>' +
                '<strong>Note:</strong> If your domain is hosted on Zoho EU, use <code>smtp.zoho.eu</code> instead.'
        },
        custom: {
            host: '', port: '587',
            guide: '<strong><i class="fa-solid fa-server"></i> Custom SMTP</strong><br><br>' +
                'Enter the SMTP credentials provided by your email service. Common settings:<br><br>' +
                '<strong>Port 587</strong> — TLS/STARTTLS (most common, recommended)<br>' +
                '<strong>Port 465</strong> — SSL (legacy but still supported)<br>' +
                '<strong>Port 25</strong> — Unencrypted (not recommended, often blocked)'
        }
    };

    // Provider dropdown handler
    document.getElementById('fts-smtp-provider').addEventListener('change', function() {
        const val = this.value;
        const smtpDiv = document.getElementById('fts-own-smtp');
        const guideDiv = document.getElementById('fts-smtp-guide');
        if (val && SMTP_PRESETS[val]) {
            const preset = SMTP_PRESETS[val];
            smtpDiv.style.display = 'block';
            guideDiv.style.display = 'block';
            guideDiv.innerHTML = preset.guide;
            if (preset.host) document.getElementById('fts-smtp-host').value = preset.host;
            else document.getElementById('fts-smtp-host').value = '';
            document.getElementById('fts-smtp-port').value = preset.port;
            document.getElementById('fts-smtp-user').value = '';
            document.getElementById('fts-smtp-pass').value = '';
            document.getElementById('fts-smtp-user').focus();
        } else {
            smtpDiv.style.display = 'none';
            guideDiv.style.display = 'none';
        }
    });

    initPasswordToggles(overlay);

    // Skip button
    document.getElementById('fts-skip-btn').addEventListener('click', () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    });

    // Save button
    document.getElementById('fts-save-btn').addEventListener('click', async () => {
        const btn = document.getElementById('fts-save-btn');
        const company = document.getElementById('fts-company').value.trim();
        const name = document.getElementById('fts-name').value.trim();

        if (!company || !name) {
            showToast('warning', 'Required', 'Please enter your company name and name.');
            return;
        }

        setButtonLoading(btn, true);

        try {
            const smtpProvider = document.getElementById('fts-smtp-provider').value;
            const fromName = document.getElementById('fts-from-name').value.trim() || company;
            const fromEmail = document.getElementById('fts-from-email').value.trim();

            const newSettings = {
                company_name: company,
                admin_name: name,
                email_from_name: fromName,
                email_from: fromEmail,
            };

            if (smtpProvider) {
                const host = document.getElementById('fts-smtp-host').value.trim();
                const user = document.getElementById('fts-smtp-user').value.trim();
                const pass = document.getElementById('fts-smtp-pass').value;

                if (!host || !user || !pass) {
                    showToast('warning', 'Required', 'Please fill in all SMTP fields.');
                    setButtonLoading(btn, false);
                    return;
                }

                newSettings.smtp_host = host;
                newSettings.smtp_port = document.getElementById('fts-smtp-port').value || '587';
                newSettings.smtp_username = user;
                newSettings.smtp_password = pass;
                newSettings.smtp_mode = smtpProvider;
            }

            await upsertSettings(newSettings);
            showToast('success', 'Setup Complete!', 'Your account is ready. You can now send onboarding emails to clients.');
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        } catch (err) {
            showToast('error', 'Error', err.message);
            setButtonLoading(btn, false);
        }
    });
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
    } else if (hash === '#credits' || hash.startsWith('#credits?')) {
        renderCredits(area);
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

async function sendEmail({ to_email, to_name, subject, body_text, body_html }) {
    const settings = await fetchSettings();

    if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
        throw new Error('SMTP not configured. Go to Settings → Email & SMTP to set up email sending.');
    }

    const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            smtp_host: settings.smtp_host,
            smtp_port: settings.smtp_port || '587',
            smtp_username: settings.smtp_username,
            smtp_password: settings.smtp_password,
            from_name: settings.email_from_name || 'SCALZ SEO',
            from_email: settings.email_from || settings.smtp_username,
            to_email,
            to_name: to_name || undefined,
            subject,
            body_text,
            body_html,
        }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || result.error || 'Email send failed');
    return result;
}

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
            openClientSetupWizard(async () => {
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
            openClientSetupWizard(async () => {
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

// ============================================
// ACF FIELD DETECTION
// ============================================
async function detectAcfFields(siteUrl, wpUsername, wpAppPassword) {
    if (!siteUrl) throw new Error('Site URL is required');
    
    const cleanUrl = siteUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/wp-json/scalz/v1/acf/detect-fields`;
    
    const headers = { 'Content-Type': 'application/json' };
    if (wpUsername && wpAppPassword) {
        headers['Authorization'] = 'Basic ' + btoa(`${wpUsername}:${wpAppPassword}`);
    }
    
    const response = await fetch(endpoint, { method: 'GET', headers });
    if (!response.ok) {
        throw new Error(`Failed to connect: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

async function testWpConnection(siteUrl, wpUsername, wpAppPassword) {
    if (!siteUrl) throw new Error('Site URL is required');
    
    const cleanUrl = siteUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/wp-json/scalz/v1/status`;
    
    const headers = { 'Content-Type': 'application/json' };
    if (wpUsername && wpAppPassword) {
        headers['Authorization'] = 'Basic ' + btoa(`${wpUsername}:${wpAppPassword}`);
    }
    
    const response = await fetch(endpoint, { method: 'GET', headers });
    if (!response.ok) {
        throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

// ============================================
// AUTO-SEED PROMPT TEMPLATES
// ============================================
async function seedPromptTemplatesForClient(clientData) {
    // Check if templates already exist
    const existing = await fetchPromptTemplates();
    if (existing.length > 0) return existing;
    
    // Seed from DEFAULT_PROMPT_TEMPLATES
    const seeded = [];
    for (const tpl of DEFAULT_PROMPT_TEMPLATES) {
        try {
            const saved = await upsertPromptTemplate({
                name: tpl.name,
                category: tpl.category,
                template_text: tpl.prompt,
            });
            seeded.push(saved);
        } catch (err) {
            console.error('Failed to seed template:', tpl.name, err);
        }
    }
    return seeded;
}

// ============================================
// CLIENT SETUP WIZARD
// ============================================
function openClientSetupWizard(onComplete) {
    let wizardStep = 1;
    const totalSteps = 4;
    let wizardData = {
        client: {},
        wpConnected: false,
        acfFields: null,
        promptsSeeded: false,
        manualEntry: false,
        formSent: false,
        onboardingEmail: '',
        onboardingName: '',
        onboardingMsg: '',
        onboardingLink: '',
    };

    function renderWizardStep() {
        let stepContent = '';
        let stepTitle = '';
        let stepDesc = '';

        if (wizardStep === 1) {
            stepTitle = 'Client Onboarding';
            stepDesc = 'Send an intake form to your new client, or fill in their details manually.';
            if (wizardData.formSent) {
                // Success state after sending the form
                stepContent = `
                    <div style="text-align:center;padding:var(--space-4) 0;">
                        <div style="width:64px;height:64px;border-radius:50%;background:var(--green-bg);border:2px solid var(--green);display:inline-flex;align-items:center;justify-content:center;margin-bottom:var(--space-4);">
                            <i class="fa-solid fa-paper-plane" style="font-size:1.5rem;color:var(--green);"></i>
                        </div>
                        <h3 style="margin-bottom:var(--space-2);color:var(--green);">Form Sent Successfully!</h3>
                        <p style="font-size:0.9rem;color:var(--text-secondary);max-width:420px;margin:0 auto var(--space-4);">The onboarding email has been opened in your mail client. The link has also been copied to your clipboard.</p>
                        <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);padding:var(--space-3) var(--space-4);margin-bottom:var(--space-4);display:flex;align-items:center;gap:var(--space-3);">
                            <span style="flex:1;font-size:0.8rem;word-break:break-all;color:var(--text-secondary);" id="wz-sent-link-url">${escHtml(wizardData.onboardingLink || '')}</span>
                            <button class="btn btn-ghost btn-sm" id="wz-copy-sent-link"><i class="fa-solid fa-copy"></i> Copy</button>
                        </div>
                        <p style="font-size:0.8rem;color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Once the client fills out the form, their information will automatically appear in your Clients dashboard.</p>
                    </div>
                `;
            } else if (wizardData.manualEntry) {
                // Manual entry path — show the business info fields
                stepContent = `
                    <div class="form-group">
                        <label for="wz-biz">Business Name <span class="required">*</span></label>
                        <input type="text" id="wz-biz" value="${escHtml(wizardData.client.business_name || '')}" placeholder="Acme Roofing Co." required />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="wz-niche">Niche / Industry</label>
                            <input type="text" id="wz-niche" value="${escHtml(wizardData.client.niche || '')}" placeholder="Roofing, HVAC, Plumbing…" />
                        </div>
                        <div class="form-group">
                            <label for="wz-services">Services</label>
                            <input type="text" id="wz-services" value="${escHtml(Array.isArray(wizardData.client.services) ? wizardData.client.services.join(', ') : (wizardData.client.services || ''))}" placeholder="e.g., Roof Replacement, Roof Repair, Storm Damage, Gutters, Siding" />
                            <span class="form-hint">Enter each service separated by a comma.</span>
                        </div>
                    </div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label for="wz-city">City</label>
                            <input type="text" id="wz-city" value="${escHtml(wizardData.client.city || '')}" placeholder="Dallas" />
                        </div>
                        <div class="form-group">
                            <label for="wz-state">State</label>
                            <input type="text" id="wz-state" value="${escHtml(wizardData.client.state || '')}" placeholder="Texas" />
                        </div>
                        <div class="form-group">
                            <label for="wz-state-abbr">Abbr.</label>
                            <input type="text" id="wz-state-abbr" value="${escHtml(wizardData.client.state_abbr || '')}" maxlength="2" placeholder="TX" style="text-transform:uppercase;" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="wz-address">Address</label>
                        <input type="text" id="wz-address" value="${escHtml(wizardData.client.address || '')}" placeholder="123 Main St, Dallas TX 75001" />
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="wz-phone">Phone</label>
                            <input type="tel" id="wz-phone" value="${escHtml(wizardData.client.phone || '')}" placeholder="(214) 555-0100" />
                        </div>
                        <div class="form-group">
                            <label for="wz-email">Contact Email</label>
                            <input type="email" id="wz-email" value="${escHtml(wizardData.client.contact_email || '')}" placeholder="owner@acme.com" />
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="wz-notes">Special Instructions</label>
                        <textarea id="wz-notes" rows="2" placeholder="Any special notes…">${escHtml(wizardData.client.special_instructions || '')}</textarea>
                    </div>
                `;
            } else {
                // Default two-path choice
                stepContent = `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);">
                        <!-- Left card: Send Intake Form -->
                        <div style="padding:var(--space-5);background:var(--bg-input);border:2px solid var(--accent);border-radius:var(--radius);display:flex;flex-direction:column;gap:var(--space-4);">
                            <div>
                                <div style="font-weight:700;font-size:1rem;margin-bottom:var(--space-1);">&#128231; Send Intake Form</div>
                                <div style="font-size:0.8rem;color:var(--text-muted);">Recommended &mdash; let the client fill in their own details</div>
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label for="wz-ob-email">Client Email <span class="required">*</span></label>
                                <input type="email" id="wz-ob-email" value="${escHtml(wizardData.onboardingEmail || '')}" placeholder="owner@acme.com" />
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label for="wz-ob-name">Client Name <span style="font-size:0.75rem;color:var(--text-muted);">(optional)</span></label>
                                <input type="text" id="wz-ob-name" value="${escHtml(wizardData.onboardingName || '')}" placeholder="Jane Smith" />
                            </div>
                            <div class="form-group" style="margin:0;">
                                <label for="wz-ob-msg">Custom Message <span style="font-size:0.75rem;color:var(--text-muted);">(optional)</span></label>
                                <textarea id="wz-ob-msg" rows="3" placeholder="Add a personal note…">${escHtml(wizardData.onboardingMsg || "Welcome! We're excited to help you grow your online presence. Please fill out the quick form below so we can get started.")}</textarea>
                            </div>
                            <button class="btn btn-primary" id="wz-send-form-btn" style="width:100%;">
                                <i class="fa-solid fa-paper-plane"></i> Send Onboarding Form
                            </button>
                            <div id="wz-ob-link-result" style="display:none;"></div>
                        </div>

                        <!-- Right card: Fill In Manually -->
                        <div style="padding:var(--space-5);background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;gap:var(--space-4);">
                            <div>
                                <div style="font-weight:700;font-size:1rem;margin-bottom:var(--space-1);">&#9999;&#65039; Fill In Manually</div>
                                <div style="font-size:0.8rem;color:var(--text-muted);">Already have the client's info? Enter it directly.</div>
                            </div>
                            <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">Use this option if you already have all of the client's business information on hand and want to create their profile right now.</p>
                            <div style="flex:1;"></div>
                            <button class="btn btn-ghost" id="wz-manual-btn" style="width:100%;">
                                Enter Details Manually <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        } else if (wizardStep === 2) {
            stepTitle = 'WordPress Connection';
            stepDesc = 'Connect to the client\'s WordPress site. The Scalz SEO Automator plugin must be installed.';
            stepContent = `
                <div class="form-group">
                    <label for="wz-site-url">Site URL <span class="required">*</span></label>
                    <input type="url" id="wz-site-url" value="${escHtml(wizardData.client.site_url || '')}" placeholder="https://acmeroofing.com" required />
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="wz-wp-user">WP Username</label>
                        <input type="text" id="wz-wp-user" value="${escHtml(wizardData.client.wp_username || '')}" placeholder="admin" autocomplete="off" />
                    </div>
                    <div class="form-group">
                        <label for="wz-wp-pass">WP App Password</label>
                        <div class="input-with-icon">
                            <input type="password" id="wz-wp-pass" value="${escHtml(wizardData.client.wp_app_password || '')}" placeholder="xxxx xxxx xxxx xxxx" autocomplete="new-password" />
                            <button type="button" class="pw-toggle" data-target="wz-wp-pass" tabindex="-1"><i class="fa-solid fa-eye"></i></button>
                        </div>
                    </div>
                </div>
                <div style="margin-top:var(--space-4);">
                    <button class="btn btn-ghost" id="wz-test-wp-btn" style="width:100%;">
                        <i class="fa-solid fa-plug"></i> Test WordPress Connection
                    </button>
                </div>
                <div id="wz-wp-result" style="margin-top:var(--space-4);display:none;"></div>
                
                <div style="margin-top:var(--space-6);padding:var(--space-4);background:var(--bg-input);border-radius:var(--radius);border:1px solid var(--border);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3);">
                        <div style="font-weight:600;"><i class="fa-solid fa-puzzle-piece" style="color:var(--accent);"></i> Scalz SEO Automator Plugin</div>
                        <button class="btn btn-ghost btn-sm" id="wz-dl-plugin-quick">
                            <i class="fa-solid fa-download"></i> Download v${SCALZ_PLUGIN.version}
                        </button>
                    </div>
                    <ul style="font-size:0.85rem;color:var(--text-secondary);list-style:disc;padding-left:var(--space-5);display:flex;flex-direction:column;gap:var(--space-1);">
                        <li>Install &amp; activate this plugin on the client's WordPress site</li>
                        <li>Create a WordPress Application Password: Users → Profile → Application Passwords</li>
                        <li>RankMath SEO plugin recommended for meta optimization</li>
                        <li>ACF PRO recommended for custom content fields</li>
                    </ul>
                </div>
            `;
        } else if (wizardStep === 3) {
            stepTitle = 'ACF Fields Detection';
            stepDesc = 'Detect Advanced Custom Fields on the client\'s WordPress site to map content areas.';
            
            const hasConnection = wizardData.client.site_url && wizardData.client.wp_username;
            
            stepContent = `
                <div style="text-align:center;padding:var(--space-6) 0;">
                    ${hasConnection ? `
                        <button class="btn btn-primary" id="wz-detect-acf-btn" style="padding:var(--space-4) var(--space-8);">
                            <i class="fa-solid fa-magnifying-glass"></i> Detect ACF Fields on ${escHtml(wizardData.client.business_name || 'Client Site')}
                        </button>
                        <p style="font-size:0.85rem;color:var(--text-muted);margin-top:var(--space-3);">This will scan the WordPress site for all ACF field groups and fields.</p>
                    ` : `
                        <div style="color:var(--amber);margin-bottom:var(--space-4);"><i class="fa-solid fa-triangle-exclamation"></i> WordPress connection not configured</div>
                        <p style="font-size:0.85rem;color:var(--text-muted);">Go back to Step 2 to configure the WordPress connection, or skip this step to use the default ACF field presets.</p>
                    `}
                </div>
                <div id="wz-acf-result"></div>
                
                <div style="margin-top:var(--space-6);">
                    <div style="font-weight:600;margin-bottom:var(--space-3);"><i class="fa-solid fa-list-check" style="color:var(--blue);"></i> Common ACF Fields (Pre-loaded)</div>
                    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:var(--space-3);">These are the standard ACF fields used in SEO service sites. Fields detected from the live site will be shown above.</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);max-height:300px;overflow-y:auto;">
                        ${COMMON_ACF_FIELDS.map(f => `
                            <div style="padding:var(--space-2) var(--space-3);background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.8rem;">
                                <div style="font-weight:600;color:var(--text-primary);">${escHtml(f.label)}</div>
                                <div style="color:var(--text-muted);font-size:0.75rem;">${escHtml(f.name)} &middot; ${escHtml(f.type)} &middot; ${escHtml(f.group)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (wizardStep === 4) {
            stepTitle = 'Review & Create';
            stepDesc = 'Review the client setup and create the client with auto-generated prompt templates.';
            
            const c = wizardData.client;
            stepContent = `
                <div style="display:grid;gap:var(--space-4);">
                    <!-- Client Summary Card -->
                    <div style="padding:var(--space-5);background:var(--bg-input);border-radius:var(--radius);border:1px solid var(--border);">
                        <div style="font-weight:700;font-size:1.1rem;margin-bottom:var(--space-3);">${escHtml(c.business_name || 'Unnamed Client')}</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);font-size:0.85rem;">
                            <div><span style="color:var(--text-muted);">Niche:</span> ${escHtml(c.niche || '\u2014')}</div>
                            <div><span style="color:var(--text-muted);">Location:</span> ${escHtml(c.city || '')}${c.state ? ', ' + escHtml(c.state) : ''}</div>
                            <div><span style="color:var(--text-muted);">Phone:</span> ${escHtml(c.phone || '\u2014')}</div>
                            <div><span style="color:var(--text-muted);">Email:</span> ${escHtml(c.email || '\u2014')}</div>
                            <div><span style="color:var(--text-muted);">Site:</span> ${c.site_url ? `<a href="${escHtml(c.site_url)}" target="_blank" rel="noopener">${escHtml(c.site_url)}</a>` : '\u2014'}</div>
                            <div><span style="color:var(--text-muted);">WP User:</span> ${escHtml(c.wp_username || '\u2014')}</div>
                            <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Services:</span> ${Array.isArray(c.services) ? c.services.map(s => `<code style="margin:0 2px;">${escHtml(s)}</code>`).join(' ') : escHtml(c.services || '\u2014')}</div>
                        </div>
                    </div>
                    
                    <!-- Auto-Setup Options -->
                    <div style="padding:var(--space-5);background:var(--bg-input);border-radius:var(--radius);border:1px solid var(--border);">
                        <div style="font-weight:600;margin-bottom:var(--space-3);"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--blue);"></i> Auto-Setup Options</div>
                        <div style="display:flex;flex-direction:column;gap:var(--space-3);">
                            <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;font-size:0.9rem;">
                                <input type="checkbox" id="wz-seed-prompts" checked style="width:18px;height:18px;" />
                                <div>
                                    <div style="font-weight:500;">Auto-generate prompt templates</div>
                                    <div style="font-size:0.8rem;color:var(--text-muted);">Create all 11 production SEO prompt templates with client variables pre-configured</div>
                                </div>
                            </label>
                            <label style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;font-size:0.9rem;">
                                <input type="checkbox" id="wz-set-active" checked style="width:18px;height:18px;" />
                                <div>
                                    <div style="font-weight:500;">Set status to Active</div>
                                    <div style="font-size:0.8rem;color:var(--text-muted);">Mark client as active immediately (otherwise set to Onboarding)</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Prompt Templates Preview -->
                    <div style="padding:var(--space-5);background:var(--bg-input);border-radius:var(--radius);border:1px solid var(--border);">
                        <div style="font-weight:600;margin-bottom:var(--space-3);"><i class="fa-solid fa-file-lines" style="color:var(--blue);"></i> Prompt Templates to be Created (${DEFAULT_PROMPT_TEMPLATES.length})</div>
                        <div style="display:grid;gap:var(--space-2);max-height:250px;overflow-y:auto;">
                            ${DEFAULT_PROMPT_TEMPLATES.map((t, i) => `
                                <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) var(--space-3);background:var(--bg-surface);border-radius:var(--radius-sm);font-size:0.85rem;">
                                    <div>
                                        <span style="font-weight:500;">${escHtml(t.name)}</span>
                                        <code style="margin-left:var(--space-2);font-size:0.75rem;color:var(--text-muted);">${escHtml(t.category)}</code>
                                    </div>
                                    <i class="fa-solid fa-check" style="color:var(--green);"></i>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Progress indicators
        const stepNames = ['Onboarding', 'WordPress', 'ACF Fields', 'Review & Create'];
        const progressHtml = `
            <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-6);">
                ${stepNames.map((name, i) => `
                    <div style="flex:1;text-align:center;">
                        <div style="width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;
                            ${i + 1 < wizardStep ? 'background:var(--green);color:#fff;' : i + 1 === wizardStep ? 'background:var(--blue);color:#fff;' : 'background:var(--bg-input);color:var(--text-muted);border:1px solid var(--border);'}">
                            ${i + 1 < wizardStep ? '<i class="fa-solid fa-check"></i>' : i + 1}
                        </div>
                        <div style="font-size:0.7rem;margin-top:4px;color:${i + 1 <= wizardStep ? 'var(--text-primary)' : 'var(--text-muted)'};"}>${name}</div>
                    </div>
                `).join('')}
            </div>
        `;

        const body = `
            ${progressHtml}
            <div style="margin-bottom:var(--space-4);">
                <h3 style="margin-bottom:2px;">${stepTitle}</h3>
                <p style="font-size:0.85rem;color:var(--text-secondary);">${stepDesc}</p>
            </div>
            ${stepContent}
            <div class="modal-footer" style="margin-top:var(--space-6);">
                ${wizardStep === 1 && wizardData.formSent
                    ? `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`
                    : wizardStep > 1
                        ? '<button class="btn btn-ghost" id="wz-back-btn"><i class="fa-solid fa-arrow-left"></i> Back</button>'
                        : '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>'
                }
                <div style="display:flex;gap:var(--space-2);">
                    ${wizardStep === 1 && wizardData.formSent ? `
                        <button class="btn btn-primary" id="wz-continue-wp-btn">Continue to WordPress Setup <i class="fa-solid fa-arrow-right"></i></button>
                    ` : wizardStep < totalSteps ? `
                        ${wizardStep === 2 || wizardStep === 3 ? '<button class="btn btn-ghost" id="wz-skip-btn">Skip <i class="fa-solid fa-forward"></i></button>' : ''}
                        ${wizardStep === 1 && !wizardData.manualEntry ? '' : '<button class="btn btn-primary" id="wz-next-btn">Next <i class="fa-solid fa-arrow-right"></i></button>'}
                    ` : `
                        <button class="btn btn-primary" id="wz-create-btn">
                            <span class="btn-text"><i class="fa-solid fa-rocket"></i> Create Client &amp; Setup</span>
                            <span class="btn-spinner" style="display:none;"><i class="fa-solid fa-spinner fa-spin"></i></span>
                        </button>
                    `}
                </div>
            </div>
        `;

        openModal(`New Client Setup \u2014 Step ${wizardStep} of ${totalSteps}`, body, { size: 'lg' });

        // Wire up event handlers
        wireWizardEvents();
    }

    function saveCurrentStepData() {
        if (wizardStep === 1 && wizardData.manualEntry) {
            const rawServices = document.getElementById('wz-services')?.value || '';
            wizardData.client = {
                ...wizardData.client,
                business_name: document.getElementById('wz-biz')?.value.trim() || '',
                niche: document.getElementById('wz-niche')?.value.trim() || '',
                city: document.getElementById('wz-city')?.value.trim() || '',
                state: document.getElementById('wz-state')?.value.trim() || '',
                state_abbr: (document.getElementById('wz-state-abbr')?.value || '').toUpperCase(),
                address: document.getElementById('wz-address')?.value.trim() || '',
                phone: document.getElementById('wz-phone')?.value.trim() || '',
                contact_email: document.getElementById('wz-email')?.value.trim() || '',
                services: rawServices ? rawServices.split(',').map(s => s.trim()).filter(Boolean) : [],
                special_instructions: document.getElementById('wz-notes')?.value.trim() || '',
            };
        } else if (wizardStep === 2) {
            wizardData.client = {
                ...wizardData.client,
                site_url: document.getElementById('wz-site-url')?.value.trim() || '',
                wp_username: document.getElementById('wz-wp-user')?.value.trim() || '',
                wp_app_password: document.getElementById('wz-wp-pass')?.value || '',
            };
        }
    }

    function wireWizardEvents() {
        // ---- STEP 1: Send Intake Form button ----
        document.getElementById('wz-send-form-btn')?.addEventListener('click', async () => {
            const btn   = document.getElementById('wz-send-form-btn');
            const email = document.getElementById('wz-ob-email')?.value.trim();
            const name  = document.getElementById('wz-ob-name')?.value.trim();
            const msg   = document.getElementById('wz-ob-msg')?.value.trim();

            if (!email) { showToast('warning', 'Required', 'Please enter the client\'s email address.'); return; }

            setButtonLoading(btn, true);
            try {
                const token = generateSecureToken();
                await createOnboardingToken({
                    token,
                    client_name: name || null,
                    email,
                    message: msg || null,
                    status: 'pending',
                });

                const link = `${window.location.origin}${window.location.pathname}#onboard/${token}`;

                // Compose the email
                const settings = await fetchSettings();
                const senderName = settings.email_from_name || settings.company_name || 'SCALZ SEO';
                const subject = 'Your SEO Onboarding Form \u2014 Let\'s Get Started';

                const bodyText = `Hi ${name || 'there'},\n\nWelcome! We're excited to help you grow your online presence.\n\nTo get started, please fill out our quick onboarding form. It takes about 5 minutes and helps us understand your business, services, and target market.\n\n\uD83D\uDC49 Fill out your form here:\n${link}\n\nWhat we'll need from you:\n\u2022 Your business name and contact info\n\u2022 Services you offer\n\u2022 Your primary target location and service areas\n\u2022 Your website URL and WordPress access credentials\n\nIf you have any questions, just reply to this email.\n\nLooking forward to working with you!\n\nBest regards,\n${senderName}`;

                const bodyHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
    <div style="background: linear-gradient(135deg, #050913, #0a1628); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #13e4e6; margin: 0; font-size: 24px;">Let's Get Started! \uD83D\uDE80</h1>
    </div>
    <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb;">
        <p style="font-size: 16px; line-height: 1.6;">Hi <strong>${escHtml(name || 'there')}</strong>,</p>
        <p style="font-size: 16px; line-height: 1.6;">Welcome! We're excited to help you grow your online presence.</p>
        <p style="font-size: 16px; line-height: 1.6;">To get started, please fill out our quick onboarding form. It takes about 5 minutes and helps us understand your business, services, and target market.</p>
        <div style="text-align: center; margin: 32px 0;">
            <a href="${escHtml(link)}" style="display: inline-block; background: linear-gradient(135deg, #6600FF, #13e4e6); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 16px;">Fill Out Your Onboarding Form \u2192</a>
        </div>
        <p style="font-size: 14px; color: #666; line-height: 1.5;"><strong>What we'll need from you:</strong></p>
        <ul style="font-size: 14px; color: #666; line-height: 1.8; padding-left: 20px;">
            <li>Your business name and contact info</li>
            <li>Services you offer</li>
            <li>Your primary target location and service areas</li>
            <li>Your website URL and WordPress access credentials</li>
        </ul>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">If you have any questions, just reply to this email.</p>
        <p style="font-size: 16px; line-height: 1.6;">Looking forward to working with you!</p>
        <p style="font-size: 16px; line-height: 1.6;">Best regards,<br><strong>${escHtml(senderName)}</strong></p>
    </div>
    <div style="background: #f9fafb; padding: 16px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
        <p style="font-size: 12px; color: #999; margin: 0;">Powered by ${escHtml(settings.company_name || 'SCALZ SEO Automation')}</p>
    </div>
</div>`;

                // Try sending via SMTP
                let emailSent = false;
                try {
                    await sendEmail({
                        to_email: email,
                        to_name: name || undefined,
                        subject,
                        body_text: bodyText,
                        body_html: bodyHtml,
                    });
                    emailSent = true;
                } catch (smtpErr) {
                    console.warn('SMTP send failed, falling back to mailto:', smtpErr.message);
                    // Fallback to mailto
                    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
                    window.open(mailtoUrl, '_blank');
                }

                // Copy to clipboard
                try { await navigator.clipboard.writeText(link); } catch (_) {}

                // Save state and show success
                wizardData.onboardingEmail = email;
                wizardData.onboardingName  = name;
                wizardData.onboardingMsg   = msg;
                wizardData.onboardingLink  = link;
                wizardData.formSent        = true;

                if (emailSent) {
                    showToast('success', 'Email Sent!', `Onboarding email sent to ${email}. Link also copied to clipboard.`);
                } else {
                    showToast('info', 'Email Opened', 'SMTP not configured \u2014 email opened in your mail client. Link copied to clipboard.');
                }
                renderWizardStep();
            } catch (err) {
                showToast('error', 'Error', err.message);
                setButtonLoading(btn, false);
            }
        });

        // ---- STEP 1: Fill In Manually button ----
        document.getElementById('wz-manual-btn')?.addEventListener('click', () => {
            wizardData.manualEntry = true;
            renderWizardStep();
        });

        // ---- STEP 1 (formSent): Copy sent link ----
        document.getElementById('wz-copy-sent-link')?.addEventListener('click', async () => {
            const link = wizardData.onboardingLink || '';
            if (link) {
                try { await navigator.clipboard.writeText(link); } catch (_) {}
                showToast('success', 'Copied!', 'Link copied to clipboard.');
                const btn = document.getElementById('wz-copy-sent-link');
                if (btn) {
                    const orig = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
                    setTimeout(() => { if (btn) btn.innerHTML = orig; }, 2000);
                }
            }
        });

        // ---- STEP 1 (formSent): Continue to WordPress Setup ----
        document.getElementById('wz-continue-wp-btn')?.addEventListener('click', () => {
            wizardStep++;
            renderWizardStep();
        });

        // Back button
        document.getElementById('wz-back-btn')?.addEventListener('click', () => {
            saveCurrentStepData();
            wizardStep--;
            renderWizardStep();
        });

        // Next button
        document.getElementById('wz-next-btn')?.addEventListener('click', () => {
            // Validate step 1 manual entry
            if (wizardStep === 1 && wizardData.manualEntry) {
                const biz = document.getElementById('wz-biz')?.value.trim();
                if (!biz) { showToast('warning', 'Required', 'Business name is required.'); return; }
            }
            saveCurrentStepData();
            wizardStep++;
            renderWizardStep();
        });

        // Skip button
        document.getElementById('wz-skip-btn')?.addEventListener('click', () => {
            saveCurrentStepData();
            wizardStep++;
            renderWizardStep();
        });

        // Auto-uppercase state abbr
        const stateAbbrInput = document.getElementById('wz-state-abbr');
        if (stateAbbrInput) {
            stateAbbrInput.addEventListener('input', () => {
                stateAbbrInput.value = stateAbbrInput.value.toUpperCase().slice(0, 2);
            });
        }

        // Password toggle
        document.querySelectorAll('.pw-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                if (target) {
                    target.type = target.type === 'password' ? 'text' : 'password';
                    btn.querySelector('i').className = target.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
                }
            });
        });

        // Test WP Connection (step 2)
        document.getElementById('wz-test-wp-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('wz-test-wp-btn');
            const resultDiv = document.getElementById('wz-wp-result');
            const siteUrl = document.getElementById('wz-site-url')?.value.trim();
            const wpUser = document.getElementById('wz-wp-user')?.value.trim();
            const wpPass = document.getElementById('wz-wp-pass')?.value;

            if (!siteUrl) { showToast('warning', 'Required', 'Please enter the site URL.'); return; }

            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing Connection\u2026';
            btn.disabled = true;
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div style="text-align:center;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Connecting to WordPress\u2026</div>';

            try {
                const result = await testWpConnection(siteUrl, wpUser, wpPass);
                wizardData.wpConnected = true;
                resultDiv.innerHTML = `
                    <div style="padding:var(--space-4);background:var(--green-bg);border:1px solid var(--green);border-radius:var(--radius);color:var(--green);">
                        <i class="fa-solid fa-circle-check"></i> <strong>Connected successfully!</strong>
                        <div style="font-size:0.85rem;margin-top:var(--space-2);color:var(--text-secondary);">
                            Plugin version: ${escHtml(result.version || result.plugin_version || 'Unknown')}<br>
                            WordPress: ${escHtml(result.wp_version || 'Unknown')}
                        </div>
                        ${(() => {
                            const remoteVer = result.version || result.plugin_version || '0.0.0';
                            if (remoteVer < SCALZ_PLUGIN.version) {
                                return `
                                    <div style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--green);">
                                        <div style="color:var(--amber);font-size:0.85rem;margin-bottom:var(--space-2);">
                                            <i class="fa-solid fa-triangle-exclamation"></i> Update available: v${SCALZ_PLUGIN.version}
                                        </div>
                                        <button class="btn btn-ghost btn-sm" id="wz-update-plugin-btn">
                                            <i class="fa-solid fa-cloud-arrow-up"></i> Update Plugin
                                        </button>
                                    </div>
                                `;
                            }
                            return '';
                        })()}
                    </div>
                `;

                // Bind update button if it exists
                document.getElementById('wz-update-plugin-btn')?.addEventListener('click', async () => {
                    const updateBtn = document.getElementById('wz-update-plugin-btn');
                    updateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating\u2026';
                    updateBtn.disabled = true;
                    try {
                        const cleanUrl = siteUrl.replace(/\/+$/, '');
                        const headers = {
                            'Content-Type': 'application/json',
                            'Authorization': 'Basic ' + btoa(`${wpUser}:${wpPass}`)
                        };
                        const resp = await fetch(`${cleanUrl}/wp-json/scalz/v1/plugins/install`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ plugin_file_url: SCALZ_PLUGIN.downloadUrl })
                        });
                        if (!resp.ok) throw new Error('Update failed');
                        showToast('success', 'Updated', 'Plugin updated to v' + SCALZ_PLUGIN.version);
                        updateBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Updated!';
                    } catch (e) {
                        showToast('error', 'Update Failed', e.message);
                        updateBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Update Plugin';
                        updateBtn.disabled = false;
                    }
                });
            } catch (err) {
                wizardData.wpConnected = false;
                resultDiv.innerHTML = `
                    <div style="padding:var(--space-4);background:var(--red-bg);border:1px solid var(--red);border-radius:var(--radius);color:var(--red);margin-bottom:var(--space-4);">
                        <i class="fa-solid fa-circle-xmark"></i> <strong>Connection failed</strong>
                        <div style="font-size:0.85rem;margin-top:var(--space-2);">${escHtml(err.message)}</div>
                    </div>
                    <div style="padding:var(--space-5);background:linear-gradient(135deg, rgba(19,228,230,0.08), rgba(102,0,255,0.08));border:1px solid var(--border-accent, var(--border));border-radius:var(--radius);">
                        <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4);">
                            <div style="width:48px;height:48px;border-radius:var(--radius);background:var(--accent);display:flex;align-items:center;justify-content:center;">
                                <i class="fa-solid fa-download" style="font-size:1.25rem;color:var(--bg-primary);"></i>
                            </div>
                            <div>
                                <div style="font-weight:700;font-size:1rem;color:var(--text-primary);">Install Scalz SEO Automator Plugin</div>
                                <div style="font-size:0.8rem;color:var(--text-muted);">v${SCALZ_PLUGIN.version} &middot; Required for all automation features</div>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="wz-download-plugin-btn" style="width:100%;margin-bottom:var(--space-4);">
                            <i class="fa-solid fa-download"></i> Download Plugin (.zip)
                        </button>
                        <div style="font-size:0.85rem;color:var(--text-secondary);">
                            <div style="font-weight:600;margin-bottom:var(--space-2);">Quick Install Steps:</div>
                            <ol style="padding-left:var(--space-5);display:flex;flex-direction:column;gap:var(--space-1);">
                                <li>Download the plugin zip above</li>
                                <li>In WordPress admin, go to <strong>Plugins → Add New → Upload Plugin</strong></li>
                                <li>Choose the downloaded zip file and click <strong>Install Now</strong></li>
                                <li>Click <strong>Activate Plugin</strong></li>
                                <li>Create an <strong>Application Password</strong>: Users → Your Profile → Application Passwords</li>
                                <li>Come back here and test the connection again</li>
                            </ol>
                        </div>
                    </div>
                `;

                document.getElementById('wz-download-plugin-btn')?.addEventListener('click', () => {
                    const a = document.createElement('a');
                    a.href = SCALZ_PLUGIN.downloadUrl;
                    a.download = SCALZ_PLUGIN.filename;
                    a.click();
                    showToast('success', 'Downloading', 'Plugin zip is downloading. Install it via WordPress admin.');
                });
            }
            btn.innerHTML = '<i class="fa-solid fa-plug"></i> Test WordPress Connection';
            btn.disabled = false;
        });

        // Quick download plugin button (step 2 info box)
        document.getElementById('wz-dl-plugin-quick')?.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = SCALZ_PLUGIN.downloadUrl;
            a.download = SCALZ_PLUGIN.filename;
            a.click();
            showToast('success', 'Downloading', 'Plugin zip is downloading.');
        });

        // Detect ACF Fields (step 3)
        document.getElementById('wz-detect-acf-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('wz-detect-acf-btn');
            const resultDiv = document.getElementById('wz-acf-result');

            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning for ACF Fields\u2026';
            btn.disabled = true;

            try {
                const result = await detectAcfFields(
                    wizardData.client.site_url,
                    wizardData.client.wp_username,
                    wizardData.client.wp_app_password
                );
                wizardData.acfFields = result;

                if (!result.acf_active) {
                    resultDiv.innerHTML = `
                        <div style="padding:var(--space-4);background:var(--amber-bg);border:1px solid var(--amber);border-radius:var(--radius);color:var(--amber);margin-top:var(--space-4);">
                            <i class="fa-solid fa-triangle-exclamation"></i> <strong>ACF Not Active</strong>
                            <div style="font-size:0.85rem;margin-top:var(--space-2);color:var(--text-secondary);">
                                ${escHtml(result.message || 'ACF is not installed on this site.')} The default field presets below will be used instead.
                            </div>
                        </div>
                    `;
                } else {
                    const fieldsHtml = result.field_groups.map(group => `
                        <div style="padding:var(--space-3);background:var(--bg-surface);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:var(--space-2);">
                            <div style="font-weight:600;font-size:0.9rem;margin-bottom:var(--space-2);">
                                <i class="fa-solid fa-layer-group" style="color:var(--blue);"></i> ${escHtml(group.title)}
                                <span style="font-size:0.75rem;color:var(--text-muted);margin-left:var(--space-2);">${group.fields.length} field(s)</span>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-1);">
                                ${group.fields.map(f => `
                                    <div style="font-size:0.8rem;padding:4px 8px;background:var(--bg-input);border-radius:4px;">
                                        <strong>${escHtml(f.label)}</strong> <code style="font-size:0.7rem;">${escHtml(f.name)}</code>
                                        <span style="color:var(--text-muted);font-size:0.7rem;"> &middot; ${escHtml(f.type)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('');

                    resultDiv.innerHTML = `
                        <div style="padding:var(--space-4);background:var(--green-bg);border:1px solid var(--green);border-radius:var(--radius);color:var(--green);margin-top:var(--space-4);margin-bottom:var(--space-4);">
                            <i class="fa-solid fa-circle-check"></i> <strong>Found ${result.total_fields} ACF field(s) in ${result.total_groups} group(s)</strong>
                            ${result.post_types ? `<div style="font-size:0.85rem;margin-top:var(--space-2);color:var(--text-secondary);">Post types: ${result.post_types.map(pt => pt.label + ' (' + pt.count + ')').join(', ')}</div>` : ''}
                        </div>
                        ${fieldsHtml}
                    `;
                }
            } catch (err) {
                resultDiv.innerHTML = `
                    <div style="padding:var(--space-4);background:var(--red-bg);border:1px solid var(--red);border-radius:var(--radius);color:var(--red);margin-top:var(--space-4);">
                        <i class="fa-solid fa-circle-xmark"></i> <strong>Detection Failed</strong>
                        <div style="font-size:0.85rem;margin-top:var(--space-2);">${escHtml(err.message)}</div>
                    </div>
                `;
            }
            btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Detect ACF Fields';
            btn.disabled = false;
        });

        // Create Client (step 4)
        document.getElementById('wz-create-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('wz-create-btn');
            setButtonLoading(btn, true);

            try {
                const seedPrompts = document.getElementById('wz-seed-prompts')?.checked;
                const setActive = document.getElementById('wz-set-active')?.checked;

                // Build client data
                const clientPayload = {
                    business_name: wizardData.client.business_name,
                    niche: wizardData.client.niche || null,
                    city: wizardData.client.city || null,
                    state: wizardData.client.state || null,
                    state_abbr: wizardData.client.state_abbr || null,
                    address: wizardData.client.address || null,
                    phone: wizardData.client.phone || null,
                    contact_email: wizardData.client.contact_email || null,
                    site_url: wizardData.client.site_url || null,
                    wp_username: wizardData.client.wp_username || null,
                    wp_password: wizardData.client.wp_app_password || null,
                    services: wizardData.client.services || [],
                    special_instructions: wizardData.client.special_instructions || null,
                    status: setActive ? 'active' : 'onboarding',
                };

                // Create the client
                const newClient = await createClient(clientPayload);
                
                // Auto-seed prompt templates if checked
                if (seedPrompts) {
                    await seedPromptTemplatesForClient(wizardData.client);
                }

                closeModal();
                showToast('success', 'Client Created!', `${wizardData.client.business_name} has been set up successfully${seedPrompts ? ' with all prompt templates' : ''}.`);
                
                if (onComplete) await onComplete(newClient);
            } catch (err) {
                showToast('error', 'Error', err.message);
                setButtonLoading(btn, false);
            }
        });
    }

    // Start the wizard
    renderWizardStep();
}

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
                <input type="email" id="cm-email" value="${escHtml(client?.contact_email || '')}" placeholder="owner@acme.com" />
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
                    <input type="password" id="cm-wp-pass" value="${escHtml(client?.wp_password || '')}" placeholder="xxxx xxxx xxxx xxxx" autocomplete="new-password" />
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
            <textarea id="cm-notes" rows="3" placeholder="Any special notes for this client…">${escHtml(client?.special_instructions || '')}</textarea>
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
            contact_email:   document.getElementById('cm-email').value.trim() || null,
            site_url:        siteUrl || null,
            wp_username:     document.getElementById('cm-wp-user').value.trim() || null,
            wp_password:     document.getElementById('cm-wp-pass').value || null,
            services:        services,
            special_instructions: document.getElementById('cm-notes').value.trim() || null,
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
                                <span class="info-value">${client.wp_password ? '<span class="badge badge-green">Configured</span>' : '<span class="badge badge-red">Not set</span>'}</span>
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
                    message: note || null,
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
                    message: msg || null,
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
                <p>${tokenRecord.message ? escHtml(tokenRecord.message) : 'Please fill out the form below so we can get your SEO campaign set up. This only takes a few minutes.'}</p>
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
                    <div class="form-group">
                        <label for="of-services">Services Offered <span class="required">*</span></label>
                        <input type="text" id="of-services" placeholder="e.g., Roof Replacement, Roof Repair, Storm Damage, Gutters, Siding" required />
                        <span class="form-hint">Enter each service separated by a comma.</span>
                    </div>

                    <div class="onboarding-section-title">Target Market</div>
                    <div class="form-row-3">
                        <div class="form-group">
                            <label for="of-city">Primary City <span class="required">*</span></label>
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
                        <label for="of-service-areas">Additional Service Areas</label>
                        <textarea id="of-service-areas" rows="2" placeholder="e.g., Fort Worth, Arlington, Plano, Irving"></textarea>
                        <span class="form-hint">List any other cities or areas you serve, separated by commas.</span>
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
            const services = servicesRaw ? servicesRaw.split(',').map(s => s.trim()).filter(Boolean).join(', ') : '';

            if (!biz || !city || !siteUrl || !wpUser || !wpPass) {
                showToast('warning', 'Missing Fields', 'Please fill in all required fields.');
                return;
            }

            setButtonLoading(btn, true);

            try {
                const notesRaw = document.getElementById('of-notes').value.trim();
                const serviceAreasRaw = document.getElementById('of-service-areas').value.trim();
                const specialInstructions = serviceAreasRaw
                    ? `Service Areas: ${serviceAreasRaw}${notesRaw ? '\n\n' + notesRaw : ''}`
                    : (notesRaw || null);

                const clientData = {
                    business_name:       biz,
                    niche:               document.getElementById('of-niche').value.trim() || null,
                    phone:               document.getElementById('of-phone').value.trim() || null,
                    address:             document.getElementById('of-address').value.trim() || null,
                    city,
                    state:               document.getElementById('of-state').value.trim() || null,
                    state_abbr:          document.getElementById('of-state-abbr').value.toUpperCase() || null,
                    contact_email:       document.getElementById('of-email').value.trim() || null,
                    site_url:            siteUrl,
                    wp_username:         wpUser,
                    wp_password:         wpPass,
                    services,
                    special_instructions: specialInstructions,
                    status:              'onboarding',
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

        // If no templates yet, use pre-built production prompts
        if (templates.length === 0) {
            templates = DEFAULT_PROMPT_TEMPLATES.map(t => ({
                id: null,
                name: t.name,
                category: t.category,
                template_text: t.prompt,
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
                        <textarea id="pt-prompt-${i}" rows="7" placeholder="Enter your prompt…">${escHtml(t.template_text || t.prompt || '')}</textarea>
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
                    <button class="btn btn-ghost" id="prompts-add-btn"><i class="fa-solid fa-plus"></i> Add Template</button>
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

                    const payload = { name, template_text: prompt, category };
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

        // Add New Template
        document.getElementById('prompts-add-btn')?.addEventListener('click', () => {
            const list = document.getElementById('prompts-list');
            const i = list.querySelectorAll('.prompt-template-card').length;
            templates.push({ id: null, name: '', category: 'custom', template_text: '' });
            const newCard = document.createElement('div');
            newCard.className = 'prompt-template-card';
            newCard.id = `ptc-${i}`;
            newCard.innerHTML = `
                <div class="prompt-template-header">
                    <div>
                        <div class="prompt-template-name">New Template</div>
                        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Category: <code>custom</code></div>
                    </div>
                    <div style="display:flex;gap:var(--space-2);">
                        <button class="btn btn-ghost btn-sm" onclick="previewPrompt(${i})"><i class="fa-solid fa-eye"></i> Preview</button>
                    </div>
                </div>
                <div class="prompt-template-body">
                    <div class="form-group">
                        <label for="pt-name-${i}">Template Name</label>
                        <input type="text" id="pt-name-${i}" value="" placeholder="Template name…" />
                    </div>
                    <div class="form-group">
                        <label for="pt-prompt-${i}">Prompt</label>
                        <textarea id="pt-prompt-${i}" rows="7" placeholder="Enter your prompt…"></textarea>
                    </div>
                    <input type="hidden" id="pt-category-${i}" value="custom" />
                </div>
            `;
            list.appendChild(newCard);
            newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById(`pt-name-${i}`).focus();
            showToast('info', 'New Template', 'Fill in the details and click Save All.');
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
                                <option value="google" ${settings.ai_provider === 'google' ? 'selected' : ''}>Google (Gemini)</option>
                                <option value="ai-engine" ${settings.ai_provider === 'ai-engine' ? 'selected' : ''}>AI Engine (Meow Apps)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="s-ai-model">Model <span class="model-tier-badge" id="model-tier-badge"></span></label>
                            <select id="s-ai-model">
                                ${Object.entries(AI_MODELS).map(([id, m]) => {
                                    const tierLabel = { economy: '\u26a1', standard: '\u2b50', premium: '\ud83d\udd25', ultra: '\ud83d\udc8e' }[m.tier] || '';
                                    const costLabel = m.creditsPerKToken + ' cr/1k tok';
                                    return `<option value="${id}" data-provider="${m.provider}" data-tier="${m.tier}" ${settings.ai_model === id ? 'selected' : ''}>${tierLabel} ${m.name} (${m.ctx}) — ${costLabel}</option>`;
                                }).join('')}
                            </select>
                            <small class="form-hint">Credits charged per 1K tokens. \u26a1 Economy &bull; \u2b50 Standard &bull; \ud83d\udd25 Premium &bull; \ud83d\udc8e Ultra</small>
                        </div>
                    </div>
                    <div class="form-group" id="google-api-key-group" style="display:none;">
                        <label for="s-google-key">Google API Key</label>
                        <div class="input-with-icon">
                            <input type="password" id="s-google-key" value="${escHtml(settings.google_api_key || '')}" placeholder="AIza…" autocomplete="new-password" />
                            <button type="button" class="pw-toggle" data-target="s-google-key" tabindex="-1"><i class="fa-solid fa-eye"></i></button>
                        </div>
                        <span class="form-hint">Get from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></span>
                    </div>
                    <div class="form-group" id="ai-engine-info" style="display:none;">
                        <div class="settings-info-box">
                            <i class="fa-solid fa-info-circle"></i>
                            <span>AI Engine runs on your WordPress site via the Meow Apps plugin. Configure the model inside AI Engine settings in WP Admin. Credits are charged at the Standard tier rate.</span>
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
                    <div class="form-group" style="margin-bottom:var(--space-3);">
                        <label for="s-smtp-provider">Quick Setup — Select Provider</label>
                        <select id="s-smtp-provider">
                            <option value="">Keep current settings</option>
                            <option value="gmail">Gmail / Google Workspace</option>
                            <option value="outlook">Outlook / Microsoft 365</option>
                            <option value="sendgrid">SendGrid</option>
                            <option value="mailgun">Mailgun</option>
                            <option value="ses">Amazon SES</option>
                            <option value="zoho">Zoho Mail</option>
                            <option value="custom">Custom SMTP</option>
                        </select>
                        <span class="form-hint">Selecting a provider auto-fills the host and port. You still need to enter your username and password.</span>
                    </div>
                    <div id="s-smtp-guide" style="display:none;padding:var(--space-3);background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:var(--space-4);font-size:0.82rem;color:var(--text-secondary);line-height:1.6;"></div>
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-smtp-host">SMTP Host</label>
                            <input type="text" id="s-smtp-host" value="${escHtml(settings.smtp_host || '')}" placeholder="smtp.gmail.com" />
                        </div>
                        <div class="form-group">
                            <label for="s-smtp-port">SMTP Port</label>
                            <input type="number" id="s-smtp-port" value="${escHtml(settings.smtp_port || '587')}" placeholder="587" min="1" max="65535" />
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
                    <div style="margin-top:var(--space-4);">
                        <button class="btn btn-ghost btn-sm" id="smtp-test-btn">
                            <i class="fa-solid fa-paper-plane"></i> Send Test Email
                        </button>
                        <span id="smtp-test-result" style="margin-left:var(--space-3);font-size:0.8rem;"></span>
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
                    <div style="padding:var(--space-4);background:linear-gradient(135deg, rgba(19,228,230,0.06), rgba(102,0,255,0.06));border:1px solid var(--border);border-radius:var(--radius);margin-bottom:var(--space-4);">
                        <div style="display:flex;align-items:center;gap:var(--space-4);">
                            <div style="width:52px;height:52px;border-radius:var(--radius);background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                <i class="fa-solid fa-bolt" style="font-size:1.3rem;color:var(--bg-primary);"></i>
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:700;font-size:1rem;">Scalz SEO Automator</div>
                                <div style="font-size:0.8rem;color:var(--text-muted);">v${SCALZ_PLUGIN.version} &middot; Core WordPress plugin for all automation</div>
                            </div>
                            <button class="btn btn-primary btn-sm" id="download-scalz-plugin-btn">
                                <i class="fa-solid fa-download"></i> Download
                            </button>
                        </div>
                        <div style="margin-top:var(--space-3);font-size:0.8rem;color:var(--text-secondary);">
                            Install on each client's WordPress site to enable content automation, ACF field detection, internal linking, and plugin management via the API.
                        </div>
                    </div>
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

            <!-- Blog Content Controls -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i class="fa-solid fa-blog"></i>
                    <span class="settings-section-title">Blog Content Settings</span>
                </div>
                <div class="settings-section-body">
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-blog-sections">Sections (H2s) Per Post</label>
                            <input type="number" id="s-blog-sections" value="${escHtml(settings.blog_sections_count || '5')}" min="2" max="15" />
                            <small class="form-hint">Number of H2 subheadings in each blog post</small>
                        </div>
                        <div class="form-group">
                            <label for="s-blog-paragraphs">Paragraphs Per Section</label>
                            <input type="number" id="s-blog-paragraphs" value="${escHtml(settings.blog_paragraphs_per_section || '3')}" min="1" max="8" />
                            <small class="form-hint">Paragraphs under each H2 section</small>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-blog-word-min">Min Word Count</label>
                            <input type="number" id="s-blog-word-min" value="${escHtml(settings.blog_word_count_min || '1500')}" min="500" max="10000" step="100" />
                        </div>
                        <div class="form-group">
                            <label for="s-blog-word-max">Max Word Count</label>
                            <input type="number" id="s-blog-word-max" value="${escHtml(settings.blog_word_count_max || '2000')}" min="500" max="10000" step="100" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- AI Image Settings -->
            <div class="settings-section">
                <div class="settings-section-header">
                    <i class="fa-solid fa-image"></i>
                    <span class="settings-section-title">AI Image Generation</span>
                </div>
                <div class="settings-section-body">
                    <div class="settings-row">
                        <div class="form-group">
                            <label for="s-img-provider">Image Provider</label>
                            <select id="s-img-provider">
                                <option value="none" ${!settings.ai_image_provider || settings.ai_image_provider === 'none' ? 'selected' : ''}>None (No images)</option>
                                <option value="dall-e-3" ${settings.ai_image_provider === 'dall-e-3' ? 'selected' : ''}>DALL-E 3 (OpenAI)</option>
                                <option value="dall-e-2" ${settings.ai_image_provider === 'dall-e-2' ? 'selected' : ''}>DALL-E 2 (OpenAI)</option>
                                <option value="stable-diffusion" ${settings.ai_image_provider === 'stable-diffusion' ? 'selected' : ''}>Stable Diffusion</option>
                                <option value="midjourney" ${settings.ai_image_provider === 'midjourney' ? 'selected' : ''}>Midjourney API</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="s-img-count">Images Per Blog Post</label>
                            <input type="number" id="s-img-count" value="${escHtml(settings.ai_images_per_post || '2')}" min="0" max="10" />
                            <small class="form-hint">25 credits per image generated</small>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="toggle-wrapper">
                            <span class="toggle">
                                <input type="checkbox" id="s-img-alt" ${settings.ai_image_auto_alt !== 'false' ? 'checked' : ''} />
                                <span class="toggle-slider"></span>
                            </span>
                            <span class="toggle-label">Auto-generate SEO alt text for AI images</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="s-img-style">Default Image Style</label>
                        <select id="s-img-style">
                            <option value="photorealistic" ${!settings.ai_image_style || settings.ai_image_style === 'photorealistic' ? 'selected' : ''}>Photorealistic</option>
                            <option value="illustration" ${settings.ai_image_style === 'illustration' ? 'selected' : ''}>Illustration</option>
                            <option value="3d-render" ${settings.ai_image_style === '3d-render' ? 'selected' : ''}>3D Render</option>
                            <option value="infographic" ${settings.ai_image_style === 'infographic' ? 'selected' : ''}>Infographic Style</option>
                            <option value="minimalist" ${settings.ai_image_style === 'minimalist' ? 'selected' : ''}>Minimalist</option>
                        </select>
                    </div>
                </div>
            </div>
        `;

        initPasswordToggles(area);

        // Provider ↔ model filter logic
        const providerSelect = document.getElementById('s-ai-provider');
        const modelSelect = document.getElementById('s-ai-model');
        const googleKeyGroup = document.getElementById('google-api-key-group');
        const aiEngineInfo = document.getElementById('ai-engine-info');
        const apiKeyLabel = document.querySelector('label[for="s-ai-key"]');

        function filterModelsByProvider() {
            const provider = providerSelect.value;
            let firstVisible = null;
            Array.from(modelSelect.options).forEach(opt => {
                const match = opt.dataset.provider === provider || provider === 'all';
                opt.style.display = match ? '' : 'none';
                opt.disabled = !match;
                if (match && !firstVisible) firstVisible = opt;
            });
            // If current selection is hidden, select first visible
            const currentOpt = modelSelect.options[modelSelect.selectedIndex];
            if (currentOpt && currentOpt.disabled && firstVisible) {
                firstVisible.selected = true;
            }
            // Toggle Google API key field
            if (googleKeyGroup) googleKeyGroup.style.display = provider === 'google' ? '' : 'none';
            if (aiEngineInfo) aiEngineInfo.style.display = provider === 'ai-engine' ? '' : 'none';
            // Hide standard API key for AI Engine
            const stdKeyGroup = document.getElementById('s-ai-key')?.closest('.form-group');
            if (stdKeyGroup) stdKeyGroup.style.display = provider === 'ai-engine' ? 'none' : '';
            updateModelTierBadge();
        }

        function updateModelTierBadge() {
            const badge = document.getElementById('model-tier-badge');
            const sel = modelSelect.value;
            const model = AI_MODELS[sel];
            if (badge && model) {
                const colors = { economy: '#22c55e', standard: '#f59e0b', premium: '#ef4444', ultra: '#a855f7' };
                badge.textContent = model.tier.charAt(0).toUpperCase() + model.tier.slice(1) + ' — ' + model.creditsPerKToken + ' cr/1k tok';
                badge.style.color = colors[model.tier] || 'var(--text-muted)';
                badge.style.fontSize = '0.75rem';
                badge.style.fontWeight = '600';
            }
        }

        providerSelect?.addEventListener('change', filterModelsByProvider);
        modelSelect?.addEventListener('change', updateModelTierBadge);
        filterModelsByProvider(); // initial filter on page load

        // SMTP provider quick-setup in Settings
        const SETTINGS_SMTP_PRESETS = {
            gmail:   { host: 'smtp.gmail.com',                        port: '587', guide: '<strong>Gmail / Google Workspace:</strong> Use your Gmail address as username. For password, generate an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener">App Password</a> (requires 2-Step Verification enabled). Do NOT use your Google password.' },
            outlook: { host: 'smtp.office365.com',                    port: '587', guide: '<strong>Outlook / Microsoft 365:</strong> Use your full email as username. Generate an app password at <a href="https://account.microsoft.com/security" target="_blank" rel="noopener">Microsoft Security</a>. Some orgs need SMTP AUTH enabled by an admin.' },
            sendgrid:{ host: 'smtp.sendgrid.net',                     port: '587', guide: '<strong>SendGrid:</strong> Username is literally <code>apikey</code>. Password is your SendGrid API key (starts with SG.). Create one at <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener">Settings → API Keys</a>. Verify your sending domain first.' },
            mailgun: { host: 'smtp.mailgun.org',                      port: '587', guide: '<strong>Mailgun:</strong> Username is <code>postmaster@yourdomain.com</code>. Password is set under Sending → Domain settings → SMTP credentials in <a href="https://app.mailgun.com/" target="_blank" rel="noopener">Mailgun</a>. Verify your domain first.' },
            ses:     { host: 'email-smtp.us-east-1.amazonaws.com',    port: '587', guide: '<strong>Amazon SES:</strong> Create SMTP credentials in the <a href="https://console.aws.amazon.com/ses/" target="_blank" rel="noopener">SES Console</a> under SMTP settings. Username starts with AKIA…. Change the region in the host if needed.' },
            zoho:    { host: 'smtp.zoho.com',                         port: '587', guide: '<strong>Zoho Mail:</strong> Use your Zoho email as username. Generate an app password at <a href="https://accounts.zoho.com/home" target="_blank" rel="noopener">Security → App Passwords</a>. EU users: change host to <code>smtp.zoho.eu</code>.' },
            custom:  { host: '',                                       port: '587', guide: '<strong>Custom SMTP:</strong> Port 587 (TLS) is most common. Port 465 is SSL. Port 25 is unencrypted (often blocked).' }
        };
        document.getElementById('s-smtp-provider')?.addEventListener('change', function() {
            const val = this.value;
            const guideDiv = document.getElementById('s-smtp-guide');
            if (val && SETTINGS_SMTP_PRESETS[val]) {
                const preset = SETTINGS_SMTP_PRESETS[val];
                guideDiv.style.display = 'block';
                guideDiv.innerHTML = preset.guide;
                if (preset.host) document.getElementById('s-smtp-host').value = preset.host;
                document.getElementById('s-smtp-port').value = preset.port;
            } else {
                guideDiv.style.display = 'none';
            }
        });

        // SMTP test button
        document.getElementById('smtp-test-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('smtp-test-btn');
            const resultSpan = document.getElementById('smtp-test-result');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
            btn.disabled = true;
            resultSpan.textContent = '';

            try {
                // Get current form values (not saved yet)
                const testSettings = {
                    smtp_host: document.getElementById('s-smtp-host').value.trim(),
                    smtp_port: document.getElementById('s-smtp-port').value || '587',
                    smtp_username: document.getElementById('s-smtp-user').value.trim(),
                    smtp_password: document.getElementById('s-smtp-pass').value,
                    from_name: document.getElementById('s-from-name').value.trim() || 'SCALZ SEO',
                    from_email: document.getElementById('s-from-email').value.trim() || document.getElementById('s-smtp-user').value.trim(),
                };

                if (!testSettings.smtp_host || !testSettings.smtp_username || !testSettings.smtp_password) {
                    throw new Error('Please fill in SMTP host, username, and password first.');
                }

                // Send test email to the logged-in user
                const { data: { user } } = await sb.auth.getUser();
                const response = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...testSettings,
                        to_email: user.email,
                        subject: 'SCALZ SMTP Test \u2014 It Works! \u2705',
                        body_text: 'This is a test email from your SCALZ SEO Automation dashboard. If you received this, your SMTP settings are configured correctly!',
                        body_html: '<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;"><h2 style="color:#13e4e6;">SMTP Test Successful \u2705</h2><p>This is a test email from your SCALZ SEO Automation dashboard.</p><p>If you received this, your SMTP settings are configured correctly!</p></div>',
                    }),
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.message || result.error);

                resultSpan.style.color = 'var(--green)';
                resultSpan.textContent = '\u2713 Test email sent to ' + user.email;
                showToast('success', 'Test Sent!', 'Check your inbox for the test email.');
            } catch (err) {
                resultSpan.style.color = 'var(--red)';
                resultSpan.textContent = '\u2717 ' + err.message;
                showToast('error', 'Test Failed', err.message);
            }

            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Test Email';
            btn.disabled = false;
        });

        // Add plugin button
        document.getElementById('add-plugin-btn').addEventListener('click', () => openPluginModal(null, async () => {
            const p = await fetchPluginFiles();
            document.getElementById('plugins-list').innerHTML = renderPluginsList(p);
            bindPluginDeleteButtons();
        }));

        // Download Scalz plugin button
        document.getElementById('download-scalz-plugin-btn')?.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = SCALZ_PLUGIN.downloadUrl;
            a.download = SCALZ_PLUGIN.filename;
            a.click();
            showToast('success', 'Downloading', 'Scalz SEO Automator plugin is downloading.');
        });

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
                blog_sections_count: document.getElementById('s-blog-sections').value,
                blog_paragraphs_per_section: document.getElementById('s-blog-paragraphs').value,
                blog_word_count_min: document.getElementById('s-blog-word-min').value,
                blog_word_count_max: document.getElementById('s-blog-word-max').value,
                ai_image_provider:   document.getElementById('s-img-provider').value,
                ai_images_per_post:  document.getElementById('s-img-count').value,
                ai_image_auto_alt:   document.getElementById('s-img-alt').checked ? 'true' : 'false',
                ai_image_style:      document.getElementById('s-img-style').value,
                google_api_key:      document.getElementById('s-google-key')?.value?.trim() || '',
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
   CREDITS & BILLING PAGE
============================================= */

async function fetchUserCredits() {
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        let { data, error } = await sb.from('credits').select('*').eq('user_id', user.id).single();

        if (error && error.code === 'PGRST116') {
            // No credit row — create with 100 free starter credits
            const { data: newRow, error: insertErr } = await sb.from('credits')
                .insert({ user_id: user.id, balance: 100, lifetime_purchased: 0, lifetime_used: 0 })
                .select().single();
            if (insertErr) { console.error('Credit init error:', insertErr); return; }
            data = newRow;

            // Log the welcome bonus
            await sb.from('credit_transactions').insert({
                user_id: user.id,
                type: 'bonus',
                amount: 100,
                balance_after: 100,
                description: 'Welcome bonus — 100 free credits',
            });
        } else if (error) {
            console.error('Credit fetch error:', error);
            return;
        }

        userCredits = data || { balance: 0, lifetime_purchased: 0, lifetime_used: 0 };
        updateCreditDisplays();
    } catch (err) {
        console.error('fetchUserCredits error:', err);
    }
}

function updateCreditDisplays() {
    const bal = userCredits.balance || 0;
    const formatted = bal.toLocaleString();

    const topbarCount = document.getElementById('topbar-credit-count');
    const navBadge = document.getElementById('nav-credit-badge');

    if (topbarCount) topbarCount.textContent = formatted;
    if (navBadge) navBadge.textContent = formatted;

    // Color the badge based on balance
    if (navBadge) {
        navBadge.classList.remove('badge-low', 'badge-warning', 'badge-good');
        if (bal < 100) navBadge.classList.add('badge-low');
        else if (bal < 500) navBadge.classList.add('badge-warning');
        else navBadge.classList.add('badge-good');
    }
}

async function deductCredits(taskType, quantity = 1, description = '') {
    // Get the user's selected model for model-aware pricing
    const settings = await fetchSettings();
    const modelId = settings.ai_model || 'gpt-4o-mini';
    const effectiveCost = getEffectiveCreditCost(taskType, modelId);
    const cost = effectiveCost * quantity;
    if (cost === 0) return { success: true, cost: 0 };

    const modelInfo = AI_MODELS[modelId];
    const modelName = modelInfo ? modelInfo.name : modelId;

    if (userCredits.balance < cost) {
        return { success: false, cost, balance: userCredits.balance, message: `Insufficient credits. Need ${cost} (${modelName} tier), have ${userCredits.balance}. Purchase more credits.` };
    }

    try {
        const { data: { user } } = await sb.auth.getUser();
        const newBalance = userCredits.balance - cost;
        const newLifetimeUsed = (userCredits.lifetime_used || 0) + cost;

        await sb.from('credits').update({
            balance: newBalance,
            lifetime_used: newLifetimeUsed,
            updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);

        await sb.from('credit_transactions').insert({
            user_id: user.id,
            type: 'usage',
            amount: -cost,
            balance_after: newBalance,
            description: description || `${taskType} × ${quantity} (${cost} credits)`,
            metadata: { task_type: taskType, quantity },
        });

        userCredits.balance = newBalance;
        userCredits.lifetime_used = newLifetimeUsed;
        updateCreditDisplays();

        return { success: true, cost, balance: newBalance };
    } catch (err) {
        console.error('deductCredits error:', err);
        return { success: false, cost, message: err.message };
    }
}

async function renderCredits(area) {
    currentPage = 'credits';

    // Check for returning from Stripe checkout
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const sessionId = hashParams.get('session_id');
    const status = hashParams.get('status');

    if (sessionId && status === 'success') {
        // Verify the checkout session
        try {
            const { data: { user } } = await sb.auth.getUser();
            const response = await fetch('/api/verify-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, user_id: user.id }),
            });
            const result = await response.json();
            if (result.status === 'completed') {
                showToast('success', 'Payment Successful!', `${result.credits_added?.toLocaleString()} credits added to your account.`);
                await fetchUserCredits();
            } else if (result.status === 'already_completed') {
                userCredits.balance = result.balance;
                updateCreditDisplays();
            }
        } catch (err) {
            console.error('Verify checkout error:', err);
        }
        // Clean up URL
        window.location.hash = '#credits';
        return renderCredits(area);
    }

    if (status === 'cancelled') {
        showToast('warning', 'Cancelled', 'Credit purchase was cancelled.');
        window.location.hash = '#credits';
        return renderCredits(area);
    }

    await fetchUserCredits();

    // Fetch transaction history
    let transactions = [];
    try {
        const { data: { user } } = await sb.auth.getUser();
        const { data, error } = await sb.from('credit_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        if (!error) transactions = data || [];
    } catch (err) { /* ignore */ }

    const bal = userCredits.balance || 0;
    const purchased = userCredits.lifetime_purchased || 0;
    const used = userCredits.lifetime_used || 0;

    area.innerHTML = `
        <div class="page-header">
            <div class="page-header-left">
                <h1>Credits & Billing</h1>
                <p class="page-subtitle">Purchase credits and track usage across all AI generation tasks</p>
            </div>
        </div>

        <!-- Credit Overview Cards -->
        <div class="credit-overview">
            <div class="credit-card credit-card-balance">
                <div class="credit-card-icon"><i class="fa-solid fa-coins"></i></div>
                <div class="credit-card-info">
                    <span class="credit-card-value">${bal.toLocaleString()}</span>
                    <span class="credit-card-label">Available Credits</span>
                </div>
                ${bal < 100 ? '<div class="credit-card-warning"><i class="fa-solid fa-exclamation-triangle"></i> Low balance</div>' : ''}
            </div>
            <div class="credit-card">
                <div class="credit-card-icon" style="background:rgba(34,197,94,0.15);color:#22c55e;"><i class="fa-solid fa-cart-shopping"></i></div>
                <div class="credit-card-info">
                    <span class="credit-card-value">${purchased.toLocaleString()}</span>
                    <span class="credit-card-label">Total Purchased</span>
                </div>
            </div>
            <div class="credit-card">
                <div class="credit-card-icon" style="background:rgba(239,68,68,0.15);color:#ef4444;"><i class="fa-solid fa-fire"></i></div>
                <div class="credit-card-info">
                    <span class="credit-card-value">${used.toLocaleString()}</span>
                    <span class="credit-card-label">Total Used</span>
                </div>
            </div>
        </div>

        <!-- Credit Pricing -->
        <div class="settings-section">
            <div class="settings-section-header">
                <i class="fa-solid fa-tags"></i>
                <span class="settings-section-title">Buy Credits</span>
            </div>
            <div class="settings-section-body">
                <div class="credit-packages">
                    ${Object.entries(CREDIT_PACKAGES).map(([key, pkg]) => `
                        <div class="credit-package ${pkg.popular ? 'credit-package-popular' : ''}" data-package="${key}">
                            ${pkg.popular ? '<div class="credit-package-badge">Most Popular</div>' : ''}
                            <div class="credit-package-icon" style="color:${pkg.color};">
                                <i class="fa-solid ${pkg.icon}"></i>
                            </div>
                            <div class="credit-package-name">${pkg.name}</div>
                            <div class="credit-package-credits">${pkg.credits.toLocaleString()} credits</div>
                            <div class="credit-package-price">${pkg.price}</div>
                            <div class="credit-package-per">${pkg.per_credit}/credit</div>
                            ${pkg.savings ? `<div class="credit-package-savings">${pkg.savings}</div>` : '<div class="credit-package-savings">&nbsp;</div>'}
                            <button class="btn btn-primary btn-full buy-credits-btn" data-package="${key}">
                                <i class="fa-solid fa-credit-card"></i> Purchase
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Credit Costs Reference -->
        <div class="settings-section">
            <div class="settings-section-header">
                <i class="fa-solid fa-calculator"></i>
                <span class="settings-section-title">Credit Costs Per Task</span>
            </div>
            <div class="settings-section-body">
                <p class="form-hint" style="margin-bottom:var(--space-3);">Base costs shown below. Actual cost depends on your selected AI model tier: <strong>Economy ×1</strong> • <strong>Standard ×1.5</strong> • <strong>Premium ×3</strong> • <strong>Ultra ×5</strong></p>
                <div class="credit-costs-grid">
                    ${Object.entries(CREDIT_COSTS).filter(([_, cost]) => cost > 0).map(([task, cost]) => {
                        const step = WORKFLOW_STEPS.find(s => s.id === task);
                        const name = step ? step.name : task.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        const icon = step ? step.icon : 'fa-cog';
                        return `
                            <div class="credit-cost-item">
                                <i class="fa-solid ${icon}"></i>
                                <span class="credit-cost-name">${name}</span>
                                <span class="credit-cost-amount">${cost}–${cost * 5} cr</span>
                            </div>
                        `;
                    }).join('')}
                    <div class="credit-cost-item">
                        <i class="fa-solid fa-image"></i>
                        <span class="credit-cost-name">AI Image Generation</span>
                        <span class="credit-cost-amount">25–125 cr</span>
                    </div>
                </div>
                <div style="margin-top:var(--space-4);">
                    <p class="form-hint" style="margin-bottom:var(--space-2);"><strong>Model Tier Reference (credits per 1K tokens, 2× cost markup):</strong></p>
                    <div class="credit-costs-grid">
                        ${Object.entries(AI_MODELS).map(([id, m]) => `
                            <div class="credit-cost-item">
                                <i class="fa-solid fa-microchip" style="color:${{ economy:'#22c55e', standard:'#f59e0b', premium:'#ef4444', ultra:'#a855f7' }[m.tier]}"></i>
                                <span class="credit-cost-name">${m.name}</span>
                                <span class="credit-cost-amount" style="color:${{ economy:'#22c55e', standard:'#f59e0b', premium:'#ef4444', ultra:'#a855f7' }[m.tier]}">${m.creditsPerKToken} cr/1k tok</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <!-- Transaction History -->
        <div class="settings-section">
            <div class="settings-section-header">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <span class="settings-section-title">Transaction History</span>
            </div>
            <div class="settings-section-body">
                ${transactions.length === 0 ? '<p class="text-muted">No transactions yet. Purchase credits to get started.</p>' : `
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th style="text-align:right;">Amount</th>
                                    <th style="text-align:right;">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactions.map(tx => {
                                    const date = new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    const typeClass = tx.type === 'purchase' || tx.type === 'bonus' ? 'badge-green' : tx.type === 'usage' ? 'badge-red' : 'badge-gray';
                                    const amountClass = tx.amount > 0 ? 'text-green' : 'text-red';
                                    const amountStr = tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString();
                                    return `
                                        <tr>
                                            <td>${date}</td>
                                            <td><span class="badge ${typeClass}">${tx.type}</span></td>
                                            <td>${escHtml(tx.description || '\u2014')}</td>
                                            <td style="text-align:right;" class="${amountClass}">${amountStr}</td>
                                            <td style="text-align:right;">${(tx.balance_after || 0).toLocaleString()}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        </div>
    `;

    // Bind purchase buttons
    document.querySelectorAll('.buy-credits-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const packageKey = btn.dataset.package;
            const pkg = CREDIT_PACKAGES[packageKey];
            if (!pkg) return;

            setButtonLoading(btn, true);

            try {
                const { data: { user } } = await sb.auth.getUser();
                const response = await fetch('/api/create-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        package_key: packageKey,
                        user_id: user.id,
                        user_email: user.email,
                    }),
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to create checkout session');

                // Redirect to Stripe Checkout
                if (result.checkout_url) {
                    window.open(result.checkout_url, '_blank');
                    showToast('info', 'Checkout Opened', 'Complete your purchase in the new tab. Credits will be added automatically.');
                }
            } catch (err) {
                showToast('error', 'Error', err.message);
            }

            setButtonLoading(btn, false);
        });
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

