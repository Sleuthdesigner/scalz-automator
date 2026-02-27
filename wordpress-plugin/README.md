# SEO Automator — WordPress Plugin

> Part of the Scalz SEO Automator platform. Installs on each client WordPress site.

---

## Installation

1. Copy or upload the `scalz-seo-automator/` folder to `wp-content/plugins/`
2. Activate in **WP Admin → Plugins**
3. Navigate to **SEO Automator → Settings**
4. Copy the auto-generated API key
5. Paste the key into the dashboard's **Add Client** form

---

## Configuration

### API Key
Auto-generated on first activation. Rotate it any time from the Settings page.

### AI Provider
Choose between:
- **OpenAI** — paste your `sk-...` key
- **AI Engine (Meow Apps)** — uses the AI Engine plugin already installed on the site

### Master Prompts
Customize the AI prompts used for each content type from the Settings → Prompts tab.

---

## Requirements

- WordPress 6.0+
- PHP 8.0+
- Optional: RankMath SEO (auto-installable from Settings)
- Optional: ACF (auto-installable from Settings)
- Optional: AI Engine by Meow Apps (auto-installable from Settings)
