alter table public.assignments
  add column if not exists image_object_key text,
  add column if not exists image_file_name text,
  add column if not exists image_size_bytes bigint,
  add column if not exists image_content_type text;
