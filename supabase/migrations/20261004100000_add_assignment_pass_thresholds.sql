alter table public.assignments
  add column if not exists pass_accuracy numeric,
  add column if not exists pass_wpm numeric,
  add column if not exists pass_comprehension numeric;

do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignments_pass_accuracy_check'
      and conrelid = 'public.assignments'::regclass
  ) then

    alter table public.assignments
      add constraint assignments_pass_accuracy_check
      check (
        pass_accuracy is null
        or (
          pass_accuracy >= 0
          and pass_accuracy <= 100
        )
      );

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignments_pass_wpm_check'
      and conrelid = 'public.assignments'::regclass
  ) then

    alter table public.assignments
      add constraint assignments_pass_wpm_check
      check (
        pass_wpm is null
        or pass_wpm >= 0
      );

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname = 'assignments_pass_comprehension_check'
      and conrelid = 'public.assignments'::regclass
  ) then

    alter table public.assignments
      add constraint assignments_pass_comprehension_check
      check (
        pass_comprehension is null
        or (
          pass_comprehension >= 0
          and pass_comprehension <= 100
        )
      );

  end if;

end $$;
