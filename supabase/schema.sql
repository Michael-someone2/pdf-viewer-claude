-- ============================================================================
-- Схема базы данных для PDF Просмотрщика
-- Выполните этот скрипт в Supabase Studio: SQL Editor -> New query -> Run
-- ============================================================================

-- Таблица папок (поддерживает вложенность через parent_id)
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists folders_user_id_idx on public.folders(user_id);
create index if not exists folders_parent_id_idx on public.folders(parent_id);

-- Таблица файлов (PDF)
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists files_user_id_idx on public.files(user_id);
create index if not exists files_folder_id_idx on public.files(folder_id);

-- ============================================================================
-- Row Level Security: каждый пользователь видит и управляет только своими
-- папками и файлами
-- ============================================================================

alter table public.folders enable row level security;
alter table public.files enable row level security;

drop policy if exists "Users manage own folders" on public.folders;
create policy "Users manage own folders" on public.folders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own files" on public.files;
create policy "Users manage own files" on public.files
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- Storage: приватный bucket "pdfs" для хранения PDF-файлов.
-- Путь к файлу в бакете: {user_id}/{uuid}.pdf
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

drop policy if exists "Users manage own pdf objects" on storage.objects;
create policy "Users manage own pdf objects" on storage.objects
  for all
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
