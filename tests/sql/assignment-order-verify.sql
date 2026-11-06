-- Execute SQL as a teacher with only authenticated privileges.
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

select public.reorder_class_assignments(
 '11111111-1111-4111-8111-111111111111',
 array[
  '00000000-0000-4000-8000-000000000002'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid
 ]
);
reset role;

-- Two classes have independent order, and numbering remains intact.
do $$
declare actual_a uuid[];
declare actual_b uuid[];
begin
 select array_agg(assignment_id order by display_order) into actual_a
 from public.assignment_classes where class_id='11111111-1111-4111-8111-111111111111';
 select array_agg(assignment_id order by display_order) into actual_b
 from public.assignment_classes where class_id='22222222-2222-4222-8222-222222222222';
 if actual_a is distinct from array[
  '00000000-0000-4000-8000-000000000002'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid
 ] then raise exception 'Class A reorder did not persist'; end if;
 if actual_b is distinct from array[
  '00000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000003'::uuid
 ] then raise exception 'Class B changed unexpectedly'; end if;
 if exists(select 1 from public.assignments a where
     a.id='00000000-0000-4000-8000-000000000001'
     and (a.week_no<>1 or a.gradebook_no<>1))
 then raise exception 'Gradebook number changed'; end if;
end $$;
