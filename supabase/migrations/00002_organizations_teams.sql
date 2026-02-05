-- tskills Registry Organizations & Teams Schema
-- This migration adds support for organizations and teams

-- Organizations table
create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null check (slug ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  description text default '',
  avatar_url text,
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Organization members table
create table if not exists public.org_members (
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now() not null,
  primary key (org_id, user_id)
);

-- Teams table (within organizations)
create table if not exists public.teams (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  slug text not null check (slug ~ '^[a-z][a-z0-9-]*$'),
  name text not null,
  description text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(org_id, slug)
);

-- Team members table
create table if not exists public.team_members (
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  primary key (team_id, user_id)
);

-- Alter skills table to support organization and team ownership
alter table public.skills
  add column if not exists owner_org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists team_id uuid references public.teams(id) on delete set null;

-- Make owner_id nullable (for org-owned skills)
alter table public.skills
  alter column owner_id drop not null;

-- Drop existing visibility constraint and add new one with org/team options
alter table public.skills
  drop constraint if exists skills_visibility_check;

alter table public.skills
  add constraint skills_visibility_check check (visibility in ('public', 'private', 'org', 'team'));

-- Add constraint: skill must have exactly one type of owner (user OR org)
alter table public.skills
  add constraint skills_owner_xor check (
    (owner_id is not null and owner_org_id is null) or
    (owner_id is null and owner_org_id is not null)
  );

-- Add constraint: team visibility requires team_id to be set
alter table public.skills
  add constraint skills_team_visibility check (
    visibility != 'team' or team_id is not null
  );

-- Add constraint: private visibility only allowed for user-owned skills (not org-owned)
alter table public.skills
  add constraint skills_private_requires_user_owner check (
    visibility != 'private' or owner_org_id is null
  );

-- Create indexes for performance
create index if not exists idx_organizations_slug on public.organizations(slug);
create index if not exists idx_organizations_created_by on public.organizations(created_by);
create index if not exists idx_org_members_user_id on public.org_members(user_id);
create index if not exists idx_org_members_org_id on public.org_members(org_id);
create index if not exists idx_teams_org_id on public.teams(org_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_skills_owner_org_id on public.skills(owner_org_id);
create index if not exists idx_skills_team_id on public.skills(team_id);

-- Enable Row Level Security
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Add updated_at triggers for new tables
create trigger update_organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at();

create trigger update_teams_updated_at
  before update on public.teams
  for each row execute function public.update_updated_at();
