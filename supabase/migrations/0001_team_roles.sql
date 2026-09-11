-- Gestion des membres d'équipe et des rôles (admin / lecture_seule)
--
-- À exécuter manuellement dans l'éditeur SQL de Supabase (Dashboard > SQL Editor).
-- Ce script est additif : il crée une nouvelle table team_members et ne touche
-- à aucune table existante.
--
-- IMPORTANT : ce script ne modifie PAS les policies RLS des tables existantes
-- (projects, companies, invoices, quotes, documents, planning_tasks, etc.).
-- Si vous voulez que le rôle "lecture_seule" empêche réellement l'écriture
-- côté base de données (et pas seulement côté interface), il faudra revoir
-- les policies existantes de ces tables pour restreindre INSERT/UPDATE/DELETE
-- à public.is_admin() -- ce qui n'a pas pu être fait ici sans connaître les
-- policies actuellement en place sur votre projet.

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  full_name text,
  role text not null default 'lecture_seule' check (role in ('admin', 'lecture_seule')),
  status text not null default 'pending' check (status in ('pending', 'active')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.team_members enable row level security;

-- Fonction utilitaire : l'utilisateur courant est-il admin ?
-- security definer + search_path fixe pour pouvoir lire team_members malgré la RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where user_id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- Tout utilisateur connecté peut lire la liste de l'équipe (pour afficher les
-- rôles et savoir qui est admin).
drop policy if exists "team_members_select_authenticated" on public.team_members;
create policy "team_members_select_authenticated" on public.team_members
  for select to authenticated using (true);

-- Seuls les admins peuvent inviter / modifier / retirer un membre.
drop policy if exists "team_members_admin_write" on public.team_members;
create policy "team_members_admin_write" on public.team_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- À la création d'un compte auth (connexion GitHub) :
--  - si team_members est vide -> ce premier utilisateur devient admin actif
--  - si une invitation "pending" existe pour cet email -> elle devient active
--  - sinon -> le compte est ajouté en lecture_seule actif (accès par défaut
--    prudent pour toute connexion non explicitement invitée)
create or replace function public.handle_new_team_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.team_members) then
    insert into public.team_members (user_id, email, role, status)
    values (new.id, new.email, 'admin', 'active');
  elsif exists (select 1 from public.team_members where email = new.email and status = 'pending') then
    update public.team_members set user_id = new.id, status = 'active'
    where email = new.email and status = 'pending';
  else
    insert into public.team_members (user_id, email, role, status)
    values (new.id, new.email, 'lecture_seule', 'active')
    on conflict (email) do update set user_id = excluded.user_id, status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_team_member on auth.users;
create trigger on_auth_user_created_team_member
  after insert on auth.users
  for each row execute function public.handle_new_team_member();

-- Rétro-compatibilité : si des comptes existent déjà (l'utilisateur actuel de
-- l'application) et que team_members est encore vide, on les bascule admin.
insert into public.team_members (user_id, email, role, status)
select id, email, 'admin', 'active' from auth.users
where not exists (select 1 from public.team_members)
on conflict (email) do nothing;
