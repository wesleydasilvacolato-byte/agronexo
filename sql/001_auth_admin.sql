-- AGRONEXO · Estrutura de contas e auditoria (Supabase PostgreSQL)
-- Execute uma vez no SQL Editor do projeto Supabase.
-- Todas as operações administrativas passam pelo backend Vercel com service role.
create extension if not exists pgcrypto;

create table if not exists public.agronexo_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  role text not null default 'user' check (role in ('admin','user')),
  active boolean not null default true,
  pin_hash text,
  invitation_accepted_at timestamptz,
  pin_attempts integer not null default 0 check (pin_attempts between 0 and 100),
  pin_blocked_until timestamptz,
  security_version integer not null default 1,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index if not exists agronexo_profiles_active_seen_idx
  on public.agronexo_profiles (active, last_seen_at desc);

create table if not exists public.agronexo_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agronexo_audit_created_idx
  on public.agronexo_admin_audit (created_at desc);

-- RLS: nenhuma tabela concede leitura/escrita pública, mesmo que um
-- visitante descubra a URL do Supabase ou a anon key.
alter table public.agronexo_profiles enable row level security;
alter table public.agronexo_admin_audit enable row level security;
revoke all on public.agronexo_profiles from anon, authenticated;
revoke all on public.agronexo_admin_audit from anon, authenticated;
-- A chave service_role *nunca* deve aparecer no código enviado ao browser.

comment on table public.agronexo_profiles is 'Perfis de acesso fechado do Agronexo; criação só via admin';
comment on table public.agronexo_admin_audit is 'Trilha de auditoria administrativa sem senhas ou PINs';


-- Incremento atômico do número de tentativas; impede que chamadas concorrentes
-- contornem o bloqueio de 5 tentativas.
create or replace function public.agronexo_record_pin_failure(p_user uuid)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare n integer; locked timestamptz;
begin
  select pin_attempts, pin_blocked_until into n,locked
    from public.agronexo_profiles where id=p_user for update;
  if not found then raise exception 'user not found'; end if;
  if locked > now() then return locked; end if;
  n := coalesce(n,0)+1;
  if n >= 5 then
    locked := now() + interval '15 minutes';
    update public.agronexo_profiles set pin_attempts=0,pin_blocked_until=locked where id=p_user;
    return locked;
  end if;
  update public.agronexo_profiles set pin_attempts=n,pin_blocked_until=null where id=p_user;
  return null;
end $$;
revoke all on function public.agronexo_record_pin_failure(uuid) from public,anon,authenticated;
grant execute on function public.agronexo_record_pin_failure(uuid) to service_role;
