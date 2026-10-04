alter table public.assignments
  add column if not exists pass_enabled boolean not null default false;

update public.assignments
set pass_enabled = true
where pass_enabled = false
  and (
    pass_accuracy is not null
    or pass_wpm is not null
    or pass_comprehension is not null
  );

alter table public.manual_scores
  enable row level security;

drop policy if exists "students read own manual scores"
on public.manual_scores;

create policy "students read own manual scores"
on public.manual_scores
for select
to authenticated
using (
  auth.uid() = student_id
);

grant select
on public.manual_scores
to authenticated;
