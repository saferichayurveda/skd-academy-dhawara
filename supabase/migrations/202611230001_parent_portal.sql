-- Supabase replacement for the parent progress portal.
-- All application data is accessed only through Edge Functions using the service role key.
-- Do not expose service_role credentials in browser code.

create extension if not exists pgcrypto;

create table if not exists public.student_profiles (
  profile_id text primary key,
  school_key text not null check (school_key in ('primary','l-madhyamik','u-madhyamik')),
  admission_no text not null default '',
  student_name text not null,
  father_name text not null default '',
  mother_name text not null default '',
  dob text not null default '',
  class_name text not null default '',
  pen text not null default '',
  mobile_number text not null default '',
  total_fee integer not null default 0 check (total_fee >= 0),
  marks_json jsonb not null default '{}'::jsonb,
  source_row integer,
  updated_at timestamptz not null default now()
);

create index if not exists student_profiles_school_class_name_idx
  on public.student_profiles (school_key, class_name, student_name);

create table if not exists public.parent_portal_credentials (
  profile_id text primary key references public.student_profiles(profile_id) on delete cascade,
  school_key text not null check (school_key in ('primary','l-madhyamik','u-madhyamik')),
  login_id text not null unique,
  pin_salt text not null,
  pin_hash text not null,
  active boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_report_files (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.student_profiles(profile_id) on delete cascade,
  school_key text not null check (school_key in ('primary','l-madhyamik','u-madhyamik')),
  academic_session text not null,
  report_title text not null default 'Progress Report',
  storage_path text not null unique,
  content_type text not null default 'application/pdf',
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  published boolean not null default false,
  uploaded_at timestamptz not null default now()
);

create index if not exists progress_report_profile_idx
  on public.progress_report_files (profile_id, published, academic_session);

alter table public.student_profiles enable row level security;
alter table public.parent_portal_credentials enable row level security;
alter table public.progress_report_files enable row level security;

-- No anon/authenticated policies are intentionally created.
-- Edge Functions use SUPABASE_SERVICE_ROLE_KEY after checking admin/parent tokens.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-progress-reports','student-progress-reports',false,10485760,array['application/pdf'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['application/pdf'];
