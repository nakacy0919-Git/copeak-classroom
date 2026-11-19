-- Keep existing data-URL thumbnails available for legacy display, but store all
-- newly uploaded thumbnails as tiny Cloudflare R2 objects instead of base64.
alter table public.assignments
  add column if not exists thumbnail_object_key text,
  add column if not exists thumbnail_size_bytes integer;

alter table public.assignments
  add constraint assignments_thumbnail_r2_key_valid check (
    thumbnail_object_key is null or (
      length(thumbnail_object_key) <= 160
      and thumbnail_object_key ~ '^classroom-thumbnails/[0-9a-f-]{36}/[0-9]+-[0-9a-f-]{36}[.]webp$'
    )
  );

alter table public.assignments
  add constraint assignments_thumbnail_r2_size_valid check (
    thumbnail_size_bytes is null or
    (thumbnail_size_bytes between 1 and 24576)
  );

alter table public.assignments
  add constraint assignments_thumbnail_r2_pair_valid check (
    (thumbnail_object_key is null and thumbnail_size_bytes is null)
    or (thumbnail_object_key is not null and thumbnail_size_bytes is not null)
  );
