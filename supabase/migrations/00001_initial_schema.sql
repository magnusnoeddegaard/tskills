-- tskills Registry Initial Schema
-- This migration creates the core tables for the skill registry

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Users table (synced from GitHub auth)
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  github_id bigint unique not null,
  username text unique not null,
  email text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Skills table
create table if not exists public.skills (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade not null,
  owner text not null check (owner ~ '^[a-z0-9][a-z0-9-]*$'), -- username for quick lookups
  name text not null check (name ~ '^[a-z][a-z0-9-]*$'),
  description text not null default '',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  tools text[] default array[]::text[],
  tags text[] default array[]::text[],
  latest_version text,
  downloads bigint default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(owner, name)
);

-- Skill versions table
create table if not exists public.skill_versions (
  id uuid primary key default uuid_generate_v4(),
  skill_id uuid references public.skills(id) on delete cascade not null,
  version text not null,
  content text not null,
  published_by uuid references public.users(id) not null,
  published_at timestamptz default now() not null,
  unique(skill_id, version)
);

-- Create indexes for performance
create index if not exists idx_skills_owner on public.skills(owner);
create index if not exists idx_skills_visibility on public.skills(visibility);
create index if not exists idx_skills_tags on public.skills using gin(tags);
create index if not exists idx_skill_versions_skill_id on public.skill_versions(skill_id);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.skills enable row level security;
alter table public.skill_versions enable row level security;

-- Users RLS policies
-- Anyone can read users
create policy "Users are viewable by everyone"
  on public.users for select
  using (true);

-- Users can update their own record
create policy "Users can update own record"
  on public.users for update
  using (auth.uid() = id);

-- Skills RLS policies
-- Public skills are viewable by everyone, private only by owner
create policy "Public skills are viewable by everyone"
  on public.skills for select
  using (visibility = 'public' or owner_id = auth.uid());

-- Authenticated users can insert their own skills
create policy "Users can insert own skills"
  on public.skills for insert
  with check (auth.uid() = owner_id);

-- Users can update their own skills
create policy "Users can update own skills"
  on public.skills for update
  using (auth.uid() = owner_id);

-- Users can delete their own skills
create policy "Users can delete own skills"
  on public.skills for delete
  using (auth.uid() = owner_id);

-- Skill versions RLS policies
-- Versions follow the same visibility as their parent skill
create policy "Skill versions follow skill visibility"
  on public.skill_versions for select
  using (
    exists (
      select 1 from public.skills
      where skills.id = skill_versions.skill_id
      and (skills.visibility = 'public' or skills.owner_id = auth.uid())
    )
  );

-- Authenticated users can insert versions for their own skills
create policy "Users can insert versions for own skills"
  on public.skill_versions for insert
  with check (
    exists (
      select 1 from public.skills
      where skills.id = skill_versions.skill_id
      and skills.owner_id = auth.uid()
    )
  );

-- Function to auto-create user on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, github_id, username, email, avatar_url)
  values (
    new.id,
    (new.raw_user_meta_data->>'provider_id')::bigint,
    coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username'),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    username = excluded.username,
    email = excluded.email,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create user record on auth signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at();

create trigger update_skills_updated_at
  before update on public.skills
  for each row execute function public.update_updated_at();
