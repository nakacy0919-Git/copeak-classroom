-- Teacher-authored tiny preview only. Support images remain in R2.
alter table public.assignments
  add column if not exists thumbnail_data_url text;
alter table public.assignments
  drop constraint if exists assignments_thumbnail_data_url_valid;
alter table public.assignments
  add constraint assignments_thumbnail_data_url_valid
  check (
    thumbnail_data_url is null
    or (length(thumbnail_data_url) <= 65000
        and (thumbnail_data_url like 'data:image/webp;base64,%'
             or thumbnail_data_url like 'data:image/jpeg;base64,%'))
  );
