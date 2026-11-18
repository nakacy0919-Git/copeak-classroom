-- Check target extension and RLS, using mocked authenticated identities.
update public.assignments
set lesson_type = 'self_intro'
where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
             'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

insert into public.student_intro_drafts(assignment_id,student_id,answers)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111',
        '{"name":"Yuki"}'::jsonb);

do $$
begin
  if (select count(*) from public.student_intro_drafts) <> 1 then
    raise exception 'Owner cannot read their own draft';
  end if;
end;
$$;

-- Attempt to fake an old timestamp: server trigger must replace it.
update public.student_intro_drafts
set answers = '{"name":"Yuki Revised"}'::jsonb,
    updated_at = '2000-01-01T00:00:00Z'
where assignment_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
begin
  if not exists (
    select 1 from public.student_intro_drafts
    where updated_at > current_timestamp - interval '5 minutes'
      and answers->>'name' = 'Yuki Revised'
  ) then
    raise exception 'Server did not set a new draft version';
  end if;
end;
$$;

-- Owning a profile does not confer permission to write to a Text assignment.
do $$
declare denied boolean := false;
begin
  begin
    insert into public.student_intro_drafts(assignment_id, student_id, answers)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            '11111111-1111-4111-8111-111111111111',
            '{"name":"not allowed"}'::jsonb);
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'Text assignment draft was accepted';
  end if;
end;
$$;

-- Other student must not see or modify the first student's answers.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$
declare changed integer;
begin
  if (select count(*) from public.student_intro_drafts) <> 0 then
    raise exception 'Another student can read a private draft';
  end if;
  update public.student_intro_drafts
  set answers='{"name":"hijacked"}'::jsonb
  where assignment_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'Another student changed a private draft';
  end if;
end;
$$;

-- Student not included in the assigned audience cannot create a draft.
do $$
declare denied boolean := false;
begin
  begin
    insert into public.student_intro_drafts(assignment_id, student_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '22222222-2222-4222-8222-222222222222');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then
    raise exception 'Unassigned student created a draft';
  end if;
end;
$$;

-- Even an assigned student may not edit a draft for an unpublished lesson.
do $$
declare denied boolean := false;
begin
  begin
    insert into public.student_intro_drafts(assignment_id, student_id)
    values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            '22222222-2222-4222-8222-222222222222');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then
    raise exception 'Unpublished assignment accepted a draft';
  end if;
end;
$$;
reset role;

set role anon;
do $$
declare denied boolean := false;
begin
  begin
    perform * from public.student_intro_drafts;
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then
    raise exception 'Unauthenticated role read student drafts';
  end if;
end;
$$;
reset role;
