-- Enable required extensions
create extension if not exists "uuid-ossp";

-- =============================================
-- CLIENTS TABLE
-- =============================================
create table public.clients (
    id uuid default uuid_generate_v4() primary key,
    business_name text not null,
    niche text default '',
    services text default '',
    city text default '',
    state text default '',
    state_abbr text default '',
    phone text default '',
    address text default '',
    site_url text default '',
    wp_username text default '',
    wp_password text default '',
    api_key text default '',
    contact_email text default '',
    logo_url text default '',
    special_instructions text default '',
    status text default 'onboarding' check (status in ('onboarding', 'active', 'paused', 'error')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- =============================================
-- ONBOARDING TOKENS TABLE
-- =============================================
create table public.onboarding_tokens (
    id uuid default uuid_generate_v4() primary key,
    token text unique not null default uuid_generate_v4()::text,
    email text not null,
    client_name text default '',
    message text default '',
    status text default 'pending' check (status in ('pending', 'completed', 'expired')),
    created_at timestamptz default now(),
    submitted_at timestamptz
);

-- =============================================
-- PROMPT TEMPLATES TABLE
-- =============================================
create table public.prompt_templates (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    category text not null,
    template_text text default '',
    updated_at timestamptz default now()
);

-- =============================================
-- SETTINGS TABLE (key-value store)
-- =============================================
create table public.settings (
    key text primary key,
    value text default '',
    updated_at timestamptz default now()
);

-- =============================================
-- JOBS TABLE
-- =============================================
create table public.jobs (
    id uuid default uuid_generate_v4() primary key,
    client_id uuid references public.clients(id) on delete cascade,
    task_type text not null,
    status text default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
    progress integer default 0 check (progress >= 0 and progress <= 100),
    log text default '',
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz default now()
);

-- =============================================
-- PLUGIN FILES TABLE
-- =============================================
create table public.plugin_files (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    file_url text default '',
    license_key text default '',
    auto_install boolean default false,
    created_at timestamptz default now()
);

-- =============================================
-- INDEXES
-- =============================================
create index idx_clients_status on public.clients(status);
create index idx_clients_created on public.clients(created_at desc);
create index idx_jobs_client_id on public.jobs(client_id);
create index idx_jobs_status on public.jobs(status);
create index idx_jobs_created on public.jobs(created_at desc);
create index idx_onboarding_token on public.onboarding_tokens(token);
create index idx_onboarding_status on public.onboarding_tokens(status);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger clients_updated_at before update on public.clients
    for each row execute function public.update_updated_at();

create trigger prompt_templates_updated_at before update on public.prompt_templates
    for each row execute function public.update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
-- Enable RLS on all tables
alter table public.clients enable row level security;
alter table public.onboarding_tokens enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.settings enable row level security;
alter table public.jobs enable row level security;
alter table public.plugin_files enable row level security;

-- Policies for authenticated users (dashboard users)
create policy "Authenticated users can do everything with clients"
    on public.clients for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with onboarding_tokens"
    on public.onboarding_tokens for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with prompt_templates"
    on public.prompt_templates for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with settings"
    on public.settings for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with jobs"
    on public.jobs for all using (auth.role() = 'authenticated');

create policy "Authenticated users can do everything with plugin_files"
    on public.plugin_files for all using (auth.role() = 'authenticated');

-- Anon policies for onboarding form submissions (public access for token validation + submission)
create policy "Anon can validate onboarding tokens"
    on public.onboarding_tokens for select using (true);

create policy "Anon can update onboarding tokens on submit"
    on public.onboarding_tokens for update using (true);

create policy "Anon can insert clients via onboarding"
    on public.clients for insert with check (true);

-- =============================================
-- DATABASE FUNCTIONS
-- =============================================

-- Dashboard stats function
create or replace function public.get_dashboard_stats()
returns json as $$
declare
    result json;
begin
    select json_build_object(
        'total_clients', (select count(*) from public.clients),
        'active_jobs', (select count(*) from public.jobs where status in ('queued', 'running')),
        'completed_today', (select count(*) from public.jobs where status = 'completed' and completed_at::date = current_date),
        'errors', (select count(*) from public.jobs where status = 'failed')
    ) into result;
    return result;
end;
$$ language plpgsql security definer;

-- Bulk create jobs for workflow
create or replace function public.create_workflow_jobs(p_client_id uuid, p_steps text[])
returns json as $$
declare
    step text;
    job_ids uuid[];
    new_id uuid;
begin
    foreach step in array p_steps loop
        insert into public.jobs (client_id, task_type, status, progress, started_at)
        values (p_client_id, step, 'queued', 0, now())
        returning id into new_id;
        job_ids := array_append(job_ids, new_id);
    end loop;
    return json_build_object('job_ids', job_ids, 'total', array_length(job_ids, 1));
end;
$$ language plpgsql security definer;
