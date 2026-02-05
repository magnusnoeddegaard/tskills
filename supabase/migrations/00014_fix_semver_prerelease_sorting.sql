-- Fix: The previous trigger crashed on pre-release versions (e.g. "1.0.0-beta")
-- because "0-beta" cannot be cast to integer.
-- This version strips pre-release and build metadata suffixes before parsing,
-- and treats pre-release versions as lower than the equivalent release version.

create or replace function public.update_skill_latest_version()
returns trigger as $$
begin
  update public.skills
  set latest_version = (
    select version
    from public.skill_versions
    where skill_id = NEW.skill_id
    order by
      -- Strip pre-release suffix (everything after first hyphen) and build metadata
      -- (everything after +) before splitting into integer array for comparison
      string_to_array(
        split_part(split_part(version, '+', 1), '-', 1),
        '.'
      )::int[] desc,
      -- Stable releases (no hyphen) sort above pre-releases of the same numeric version
      (position('-' in version) = 0) desc,
      -- Among pre-releases with the same numeric version, sort alphabetically
      version desc
    limit 1
  )
  where id = NEW.skill_id;
  return NEW;
end;
$$ language plpgsql security definer;
