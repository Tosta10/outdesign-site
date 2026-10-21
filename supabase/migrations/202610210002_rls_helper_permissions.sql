-- Keep the platform's automatic RLS event trigger owner-only.
-- The author API never calls this helper; its event-trigger behavior is preserved.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
