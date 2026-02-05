-- Fix race condition: latest_version is now updated atomically via trigger
-- instead of client-side read-then-write pattern.

-- Function to recalculate latest_version from skill_versions table.
-- Uses array comparison on parsed semver parts for correct ordering.
create or replace function public.update_skill_latest_version()
returns trigger as $$
begin
  update public.skills
  set latest_version = (
    select version
    from public.skill_versions
    where skill_id = NEW.skill_id
    order by string_to_array(version, '.')::int[] desc
    limit 1
  )
  where id = NEW.skill_id;
  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger on skill_versions insert to keep latest_version in sync
drop trigger if exists update_latest_version_on_insert on public.skill_versions;
create trigger update_latest_version_on_insert
  after insert on public.skill_versions
  for each row execute function public.update_skill_latest_version();
