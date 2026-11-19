-- Copeak Classroom: small cover art for assignment lists (separate from support image).
-- Additive, nullable and backward-compatible. No data rewrite and no R2 expiry.
-- Teacher writes inherit existing assignments RLS policies.
alter table public.assignments
  add column if not exists thumbnail_data_url text;

comment on column public.assignments.thumbnail_data_url
  is 'Compressed 16:9 JPEG/WebP data URL (max 90KB); for assignment cards only, not the lesson support image.';

alter table public.assignments
  drop constraint if exists assignments_thumbnail_data_url_format_check;

alter table public.assignments
  add constraint assignments_thumbnail_data_url_format_check
  check (
    thumbnail_data_url is null
    or (
      octet_length(thumbnail_data_url) <= 90000
      and thumbnail_data_url ~ '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/=]+$'
    )
  );
