-- Visites de chantier : comptes-rendus avec participants, notes, réserves,
-- photos et enregistrement vocal transcrit.
--
-- À exécuter manuellement dans l'éditeur SQL de Supabase (Dashboard > SQL Editor).

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  visit_date date not null,
  participants text,
  notes text,
  audio_path text,
  transcript text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.visit_reserves (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  description text not null,
  status text not null default 'ouvert' check (status in ('ouvert', 'resolu')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Les photos de visite sont stockées dans la table documents existante
-- (category = 'visite'), reliées à la visite via visit_id.
alter table public.documents add column if not exists visit_id uuid references public.visits(id) on delete set null;

alter table public.visits enable row level security;
alter table public.visit_reserves enable row level security;

-- Cohérent avec le reste de l'application : accès en lecture/écriture pour
-- tout utilisateur authentifié (la restriction "lecture_seule" est gérée
-- côté interface, comme pour projects/invoices/quotes).
drop policy if exists "visits_all_authenticated" on public.visits;
create policy "visits_all_authenticated" on public.visits
  for all to authenticated using (true) with check (true);

drop policy if exists "visit_reserves_all_authenticated" on public.visit_reserves;
create policy "visit_reserves_all_authenticated" on public.visit_reserves
  for all to authenticated using (true) with check (true);
