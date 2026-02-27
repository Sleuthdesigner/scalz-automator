# SEO Automator

> White-label WordPress SEO automation platform for agencies managing 50+ client sites

**Fully white-labelable — no vendor branding hardcoded.**

---

## Overview

SEO Automator is a full-stack platform built for digital agencies that need to manage SEO at scale across multiple WordPress client sites. It consists of three components:

- **Web Dashboard** — A single-page application (HTML/CSS/JS) connected to Supabase, deployable to any static host or custom subdomain
- **WordPress Plugin** — 24+ REST API endpoints covering SEO, content generation, internal linking, schema markup, and site management
- **Supabase Backend** — PostgreSQL database with Row Level Security, Edge Functions for AI generation and WP proxying, and built-in user authentication

Key capabilities:
- Supports both **OpenAI API** and **AI Engine (Meow Apps)** as AI providers
- Custom internal linking engine that replaces third-party tools like LinkWhisper
- Multi-tenant architecture — manage unlimited client sites from a single dashboard
- Built for agencies managing portfolios of 50+ WordPress sites

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Dashboard SPA  │────▶│    Supabase       │────▶│  WordPress Sites │
│  (app.scalz.ai)  │     │  (Auth, DB, Edge) │     │   (WP Plugin)    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

The dashboard authenticates users via Supabase Auth. All requests to WordPress sites are proxied through Supabase Edge Functions, keeping WP API keys server-side and never exposed to the browser.

---

## Features

### Dashboard
- Client onboarding via form-based workflow
- Sitemap parsing and page management
- AI-powered content generation (page titles, meta descriptions, blog posts)
- SEO task automation with RankMath integration
- White-label branding (custom logo, name, colors)

### WordPress Plugin (v1.1.0)
- 24+ REST API endpoints under `/wp-json/scalz/v1/`
- Custom internal linking engine with auto-linking, keyword rules, and orphan detection
- RankMath SEO integration — page titles, meta descriptions, focus keywords
- ACF WYSIWYG field content management
- Blog post generation with H2 headings and FAQ schema markup
- Image alt tag automation
- Plugin dependency management (auto-install RankMath, ACF, AI Engine)
- White-label settings — agency name, plugin name, admin menu icon

### Backend (Supabase)
- PostgreSQL with Row Level Security for multi-tenant data isolation
- Edge Functions for AI generation (`ai-generate`) and WP site proxy (`wp-proxy`)
- User authentication and session management
- Prompt template management with `{title}`, `{location}`, `{keyword}` variables

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/your-org/scalz-automator.git
cd scalz-automator
```

### 2. Set up Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Deploy edge functions
supabase functions deploy wp-proxy
supabase functions deploy ai-generate

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your Supabase URL, anon key, service role key, and OpenAI key
```

### 4. Deploy the frontend

Deploy the `frontend/` folder to any static host:

- **Vercel**: `vercel --prod frontend/`
- **Netlify**: drag and drop the `frontend/` folder in the Netlify UI
- **S3 + CloudFront**: sync `frontend/` to an S3 bucket with static hosting enabled
- **Custom subdomain**: copy files to your web server's document root (e.g., `app.youragency.com`)

Before deploying, update `frontend/config.js` with your credentials (see [Frontend Configuration](#frontend-configuration)).

### 5. Install the WordPress plugin

Upload `wordpress-plugin/` to each client site (see [WordPress Plugin Installation](#wordpress-plugin-installation)).

### 6. Configure API key in WP plugin

In WP Admin → SEO Automator → Settings, note the auto-generated API key.

### 7. Add WP site in dashboard

In the dashboard, add the site URL and API key to connect it.

---

## Frontend Configuration

Update `frontend/config.js` with your Supabase credentials before deploying:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key',
    // ...
};
```

---

## WordPress Plugin Installation

1. Zip the `wordpress-plugin/` folder, or copy it directly to `wp-content/plugins/scalz-seo-automator/`
2. Activate the plugin in **WP Admin → Plugins**
3. Navigate to **SEO Automator → Settings**
4. Copy the auto-generated API key
5. Configure your AI provider:
   - **OpenAI**: paste your API key
   - **AI Engine (Meow Apps)**: select AI Engine and ensure it's installed
6. Set up master prompts using template variables (see [Template Variables](#template-variables))

---

## White-Label Configuration

### Dashboard

Edit the `BRANDING` object in `frontend/config.js`:

```javascript
const BRANDING = {
    appName: 'Your Agency SEO Tool',
    logoUrl: 'https://your-cdn.com/logo.png',
    primaryColor: '#1a73e8',
    // ...
};
```

### WordPress Plugin

Go to **WP Admin → SEO Automator → Settings → White Label** tab to configure:
- Agency name
- Plugin display name
- Admin menu icon

No source code modifications required for white-labeling.

---

## Supabase Setup (Detailed)

### Migrations

Migrations are located in `supabase/migrations/` and run in order:

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables: sites, pages, prompts, tasks |
| `002_white_label.sql` | White-label settings per tenant |

Run all migrations with:

```bash
supabase db push
```

### Edge Functions

| Function | Description |
|----------|-------------|
| `wp-proxy` | Proxies authenticated requests to WP REST API endpoints |
| `ai-generate` | Calls OpenAI to generate SEO content using stored prompt templates |

Deploy individually:

```bash
supabase functions deploy wp-proxy
supabase functions deploy ai-generate
```

### Secrets

Set required secrets via the Supabase CLI:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

---

## API Endpoints Reference

All endpoints are under `/wp-json/scalz/v1/`. Authentication is via the `X-Scalz-API-Key` header.

### SEO

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/seo/titles` | Get page titles for all pages |
| `POST` | `/seo/titles` | Generate and save AI page titles |
| `GET` | `/seo/descriptions` | Get meta descriptions |
| `POST` | `/seo/descriptions` | Generate and save meta descriptions |
| `GET` | `/seo/focus-keywords` | Get focus keywords |
| `POST` | `/seo/focus-keywords` | Set focus keywords |
| `GET` | `/seo/alt-tags` | Get image alt tags |
| `POST` | `/seo/alt-tags` | Generate and apply alt tags |

### Content

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/content/acf` | Get ACF WYSIWYG field content |
| `POST` | `/content/acf` | Update ACF field content |
| `GET` | `/content/h2` | Get H2 headings from page content |
| `POST` | `/content/h2` | Generate and inject H2 headings |

### Blog

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/blog/generate` | Generate a single blog post |
| `POST` | `/blog/batch` | Batch generate blog posts from a topic list |

### Schema

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/schema/faq` | Generate and inject FAQ schema markup |

### Sitemap

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sitemap/parse` | Parse sitemap XML and return page inventory |

### Internal Linking

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/linking/suggestions` | Get linking suggestions for a page |
| `GET` | `/linking/report` | Full site-wide linking report |
| `GET` | `/linking/orphans` | List orphaned pages with no inbound links |
| `POST` | `/linking/apply` | Apply a set of link suggestions to pages |
| `POST` | `/linking/auto` | Run auto-linking across the entire site |
| `POST` | `/linking/index` | Re-index site content for linking analysis |
| `GET` | `/linking/config` | Get linking engine configuration |
| `PUT` | `/linking/config` | Update linking engine configuration |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Plugin health check and version info |
| `GET` | `/settings` | Get plugin settings |
| `POST` | `/settings` | Update plugin settings |
| `POST` | `/plugins/install` | Auto-install a dependency plugin |

---

## Template Variables

Prompt templates support the following interpolation variables. These are stored in Supabase and injected at generation time by the `ai-generate` Edge Function:

| Variable | Description |
|----------|-------------|
| `{title}` | The page title or post title |
| `{location}` | Geographic location associated with the page |
| `{keyword}` | Primary target keyword |
| `{site_name}` | The WordPress site name |
| `{industry}` | The client's industry or niche |

**Example prompt template:**

```
Write a compelling meta description for a {industry} business in {location}.
Page: {title}
Target keyword: {keyword}
Keep it under 160 characters and include a clear call to action.
```

Variables are defined per-site and can be overridden per-page in the dashboard.

---

## Directory Structure

```
scalz-automator/
├── frontend/                      # Dashboard SPA
│   ├── index.html                 # App shell and markup
│   ├── style.css                  # Styles
│   ├── config.js                  # Supabase credentials & branding config
│   └── app.js                     # Application logic
├── wordpress-plugin/              # WP Plugin (zip for installation)
│   ├── scalz-seo-automator.php    # Plugin entry point
│   ├── includes/
│   │   ├── class-api-endpoints.php    # REST API route registration
│   │   ├── class-internal-linker.php  # Internal linking engine
│   │   ├── class-seo-manager.php      # RankMath SEO integration
│   │   ├── class-content-manager.php  # ACF & H2 content management
│   │   ├── class-blog-manager.php     # Blog post generation
│   │   ├── class-schema-manager.php   # FAQ schema markup
│   │   ├── class-integration-manager.php  # AI provider integration
│   │   ├── class-plugin-installer.php # Dependency plugin installer
│   └── admin/
│       ├── settings-page.php      # Admin UI markup
│       └── admin.css              # Admin styles
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql # Core schema
│   │   └── 002_white_label.sql    # White-label settings schema
│   ├── seed.sql                   # Optional seed data
│   └── functions/
│       ├── wp-proxy/
│       │   └── index.ts           # WP API proxy Edge Function
└── ai-generate/
            └── index.ts           # AI content generation Edge Function
├── .env.example                   # Environment variable template
├── .gitignore
└── README.md
```

---

## Requirements

| Dependency | Version |
|------------|---------|
| WordPress | 6.0+ |
| PHP | 8.0+ |
| RankMath SEO | Latest (auto-installable) |
| ACF (Advanced Custom Fields) | Latest (auto-installable) |
| Supabase CLI | Latest |
| Node.js | 18+ (for Supabase CLI) |

---

## License

GPL-2.0-or-later — see [GNU GPL v2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html) for details.
