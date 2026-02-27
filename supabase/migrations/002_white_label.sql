-- White-label branding settings (stored in the settings table)
INSERT INTO public.settings (key, value) VALUES
('wl_agency_name', 'SEO Automator'),
('wl_accent_text', 'Automator'),
('wl_icon', 'fas fa-bolt'),
('wl_logo_url', ''),
('wl_tagline', 'WordPress SEO Automation Platform'),
('wl_accent_color', '#4f8fff'),
('wl_success_color', '#22c55e'),
('wl_footer_text', ''),
('wl_support_url', '')
ON CONFLICT (key) DO NOTHING;
