-- The original schema constrained shots.break_direction to
-- ('left', 'right', 'straight'). The putting sheet (added in
-- migration 0005-era code) writes 'left_to_right', 'right_to_left',
-- 'uphill', 'downhill' as well, which silently fail the constraint
-- and surface as a stuck "Holed it / Missed" CTA.
--
-- Drop whatever check constraint Postgres named for this column at
-- table-creation time (the default is shots_break_direction_check
-- but that's not guaranteed across environments) and recreate it
-- with the full set of seven allowed values.
do $$
declare
  cname text;
begin
  for cname in
    select conname
    from pg_constraint
    where conrelid = 'public.shots'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%break_direction%'
  loop
    execute format('alter table public.shots drop constraint %I', cname);
  end loop;
end $$;

alter table public.shots
  add constraint shots_break_direction_check
  check (
    break_direction is null
    or break_direction in (
      'left',
      'right',
      'straight',
      'left_to_right',
      'right_to_left',
      'uphill',
      'downhill'
    )
  );
