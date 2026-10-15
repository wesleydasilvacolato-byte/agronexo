-- Ativação offline de e-mail: chave exibida SOMENTE no SQL Editor do proprietário.
-- Não há rota pública para emitir chaves. Cada chave expira em 30 minutos.
create table if not exists public.agronexo_admin_setup_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.agronexo_admin_setup_codes enable row level security;
revoke all on public.agronexo_admin_setup_codes from anon, authenticated;
revoke all on public.agronexo_admin_setup_codes from public;

create or replace function public.agronexo_claim_admin_setup(p_user_id uuid, p_token text)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare claimed uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return false; end if;
  -- Uma transação atualiza SOMENTE uma chave válida, ainda não utilizada.
  update public.agronexo_admin_setup_codes
     set used_at = now()
   where user_id = p_user_id
     and token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and expires_at > now()
     and used_at is null
   returning user_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.agronexo_claim_admin_setup(uuid,text) from public, anon, authenticated;
grant execute on function public.agronexo_claim_admin_setup(uuid,text) to service_role;
