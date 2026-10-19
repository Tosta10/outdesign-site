-- Custom two-password authentication: browser roles have no database access.
create table public.studio_versions (
  id uuid primary key,
  content jsonb not null,
  created_at timestamptz not null default now()
);
create table public.studio_state (
  singleton boolean primary key default true check (singleton),
  draft jsonb not null,
  draft_revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  published_version_id uuid references public.studio_versions(id)
);
create table public.studio_sessions (
  token_hash text primary key,
  expires_at bigint not null,
  credential_version text not null
);
create index studio_sessions_expiry on public.studio_sessions(expires_at);
create table public.studio_login_buckets (
  key text primary key,
  window_id bigint not null,
  hits integer not null
);
create table public.studio_media (
  id uuid primary key,
  name text not null,
  mime text not null,
  size bigint not null check (size > 0 and size <= 25000000),
  kind text not null check (kind in ('image','audio','file')),
  path text not null unique,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.studio_versions enable row level security;
alter table public.studio_state enable row level security;
alter table public.studio_sessions enable row level security;
alter table public.studio_login_buckets enable row level security;
alter table public.studio_media enable row level security;
revoke all on public.studio_versions,public.studio_state,public.studio_sessions,public.studio_login_buckets,public.studio_media from anon,authenticated;
grant all on public.studio_versions,public.studio_state,public.studio_sessions,public.studio_login_buckets,public.studio_media to service_role;

create function public.studio_save_draft(p_content jsonb, p_expected bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  update public.studio_state set draft=p_content, draft_revision=draft_revision+1, updated_at=now()
    where singleton=true and draft_revision=p_expected
    returning jsonb_build_object('content',draft,'revision',draft_revision,'updatedAt',updated_at) into result;
  return result;
end $$;

create function public.studio_publish(p_expected bigint, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare state public.studio_state%rowtype; ids uuid[]; result jsonb;
begin
  select * into state from public.studio_state where singleton=true for update;
  if not found or state.draft_revision<>p_expected then return null; end if;
  select coalesce(array_agg(distinct substring(value from 7)::uuid),array[]::uuid[]) into ids
  from jsonb_array_elements_text(
    jsonb_build_array(state.draft#>>'{hero,image}',state.draft#>>'{music,url}')
    || jsonb_path_query_array(state.draft,'$.projects[*].image')
    || jsonb_path_query_array(state.draft,'$.attachments[*].url')
  ) where value like 'asset:%';
  if exists(select 1 from unnest(ids) as t(id) where not exists(select 1 from public.studio_media m where m.id=t.id)) then
    raise exception 'Referenced media is missing';
  end if;
  insert into public.studio_versions(id,content) values(p_id,state.draft)
    returning jsonb_build_object('id',id,'content',content,'createdAt',created_at) into result;
  update public.studio_media set is_public=true where id=any(ids);
  update public.studio_state set published_version_id=p_id where singleton=true;
  return result;
end $$;

create function public.studio_login_budget(p_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_window bigint := floor(extract(epoch from now())/900); global_hits integer; ip_hits integer;
begin
  insert into public.studio_login_buckets(key,window_id,hits) values('global',current_window,1)
  on conflict(key) do update set window_id=excluded.window_id,hits=case when public.studio_login_buckets.window_id=excluded.window_id then public.studio_login_buckets.hits+1 else 1 end returning hits into global_hits;
  insert into public.studio_login_buckets(key,window_id,hits) values('ip:'||p_key,current_window,1)
  on conflict(key) do update set window_id=excluded.window_id,hits=case when public.studio_login_buckets.window_id=excluded.window_id then public.studio_login_buckets.hits+1 else 1 end returning hits into ip_hits;
  delete from public.studio_login_buckets where window_id<current_window-2;
  return global_hits<=100 and ip_hits<=10;
end $$;

create function public.studio_delete_media(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare state public.studio_state%rowtype; media public.studio_media%rowtype;
begin
  -- Serialize deletion with publishing and draft saves to prevent missing media.
  select * into state from public.studio_state where singleton=true for update;
  select * into media from public.studio_media where id=p_id for update;
  if not found then return true; end if;
  if media.is_public or position('asset:'||p_id::text in state.draft::text)>0 then return false; end if;
  delete from public.studio_media where id=p_id;
  return true;
end $$;

revoke all on function public.studio_save_draft(jsonb,bigint),public.studio_publish(bigint,uuid),public.studio_login_budget(text),public.studio_delete_media(uuid) from public,anon,authenticated;
grant execute on function public.studio_save_draft(jsonb,bigint),public.studio_publish(bigint,uuid),public.studio_login_budget(text),public.studio_delete_media(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('studio-media','studio-media',false,25000000,array['image/jpeg','image/png','image/webp','image/avif','image/gif','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/mp4','application/pdf','application/zip','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No browser Storage policies: only the verified Edge Function can access files.
