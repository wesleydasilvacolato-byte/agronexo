-- AGRONEXO 003: registros de trabalho associados à conta do usuário
create table if not exists public.agronexo_workspace_records (
 user_id uuid not null references auth.users(id) on delete cascade,
 collection text not null check (collection in ('projects','quotes','notes','chats')),
 item_id text not null check (length(item_id) between 1 and 120),
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
 deleted_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (user_id,collection,item_id)
);
create index if not exists agronexo_workspace_updated on public.agronexo_workspace_records(user_id,updated_at desc);
alter table public.agronexo_workspace_records enable row level security;
revoke all on public.agronexo_workspace_records from anon;
grant select, insert, update, delete on public.agronexo_workspace_records to authenticated;
create policy "workspaces_select_owner" on public.agronexo_workspace_records
 for select to authenticated using ((select auth.uid())=user_id);
create policy "workspaces_insert_owner" on public.agronexo_workspace_records
 for insert to authenticated with check ((select auth.uid())=user_id);
create policy "workspaces_update_owner" on public.agronexo_workspace_records
 for update to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
create policy "workspaces_delete_owner" on public.agronexo_workspace_records
 for delete to authenticated using ((select auth.uid())=user_id);
comment on table public.agronexo_workspace_records is 'Dados operacionais por usuário. Conteúdo de chat textual, sem anexos multimídia. Deleções mantidas como lápides.';
