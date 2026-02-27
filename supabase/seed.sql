-- Default prompt templates
INSERT INTO public.prompt_templates (name, category, template_text) VALUES
('Page Title', 'page_title', '{service} in {city}, {state_abbr} | {business_name}'),
('Meta Description', 'meta_description', 'Looking for {service} in {city}, {state}? {business_name} offers professional {service} services. Call {phone} today!'),
('ACF Content', 'acf_content', 'Write SEO and AEO optimized content for a {service} page targeting {location}. The business is {business_name}, located at {address} in {city}, {state}. Include local relevance, answer common questions directly, and structure content for featured snippets.'),
('Blog Title', 'blog_title', 'Generate {count} unique blog titles for a {niche} business in {city}, {state}. The business is {business_name}. Titles should be SEO-optimized and not duplicate these existing titles:\n{existing_titles}'),
('Blog Content', 'blog_content', 'Write a comprehensive, SEO and AEO optimized blog post about "{title}" for {business_name} in {city}, {state}. Use {focus_keyword} as the primary keyword. Include:\n- An engaging introduction\n- Multiple H2 subheadings\n- Actionable advice\n- Local relevance to {city}, {state}\n- A FAQ section with 3-5 questions\n- A strong conclusion with CTA\nTarget 1500-2000 words.'),
('Alt Tag', 'alt_tag', 'Generate a descriptive, SEO-friendly alt tag for an image on a {service} page for {business_name} in {city}, {state_abbr}. Be specific and include the service and location naturally.'),
('FAQ', 'faq', 'Generate 5 FAQ questions and detailed answers about {service} in {location} for {business_name}. Make answers comprehensive (2-3 sentences each) and naturally include the service and location. Format as JSON array: [{"question": "...", "answer": "..."}]');

-- Default settings
INSERT INTO public.settings (key, value) VALUES
('ai_provider', 'openai'),
('openai_api_key', ''),
('default_model', 'gpt-4-turbo'),
('temperature', '0.7'),
('email_from_name', 'Scalz SEO'),
('email_from_email', ''),
('smtp_host', ''),
('smtp_port', '587'),
('smtp_username', ''),
('smtp_password', ''),
('email_template', 'Hello {name},\n\nWelcome to Scalz SEO Automation! Please complete your onboarding by filling out the form at the link below:\n\n{link}\n\nThis will help us set up your SEO automation. Please have your WordPress login credentials ready.\n\nBest regards,\nScalz SEO Team'),
('default_blog_count', '10'),
('default_heading_level', 'H2'),
('auto_run_workflow', 'false');
