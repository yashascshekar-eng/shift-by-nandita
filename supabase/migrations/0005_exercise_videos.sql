-- Nandita's own demo videos per exercise (public bucket, uploaded by the coach via signed upload URLs).
alter table public.exercises add column if not exists video_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-videos', 'exercise-videos', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;
