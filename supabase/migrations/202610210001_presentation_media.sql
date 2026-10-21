-- Publish actual content and brand media atomically; author assemblies stay private.
create or replace function public.studio_publish(p_expected bigint, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare state public.studio_state%rowtype; ids uuid[]; result jsonb;
begin
  select * into state from public.studio_state where singleton=true for update;
  if not found or state.draft_revision<>p_expected then return null; end if;
  select coalesce(array_agg(distinct substring(value from 7)::uuid),array[]::uuid[]) into ids
  from jsonb_array_elements_text(
    jsonb_build_array(state.draft#>>'{hero,image}',state.draft#>>'{music,url}',state.draft#>>'{presentation,logo}',state.draft#>>'{presentation,missionImage}')
    || jsonb_path_query_array(state.draft,'$.projects[*].image')
    || jsonb_path_query_array(state.draft,'$.attachments[*].url')
    || jsonb_path_query_array(state.draft,'$.workspace.nodes[*].image')
  ) where value like 'asset:%';
  if exists(select 1 from unnest(ids) as t(id) where not exists(select 1 from public.studio_media m where m.id=t.id)) then
    raise exception 'Referenced media is missing';
  end if;
  insert into public.studio_versions(id,content) values(p_id,state.draft #- '{workspace,presets}')
    returning jsonb_build_object('id',id,'content',content,'createdAt',created_at) into result;
  update public.studio_media set is_public=true where id=any(ids);
  update public.studio_state set published_version_id=p_id where singleton=true;
  return result;
end $$;
