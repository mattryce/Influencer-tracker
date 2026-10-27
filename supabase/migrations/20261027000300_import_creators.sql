-- Applies a creator CSV import plan (built by lib/creators/csv-import.ts) in one transaction.
-- security invoker: RLS still decides whether the caller may write the roster.
create or replace function public.import_creators(p_org_id uuid, p_plan jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c jsonb;
  a jsonb;
  m jsonb;
  v_creator_id uuid;
  v_created int := 0;
  v_merged int := 0;
  v_accounts int := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_created_ids uuid[] := '{}'::uuid[];
  v_rows int;
begin
  for c in select * from jsonb_array_elements(coalesce(p_plan -> 'creates', '[]'::jsonb)) loop
    insert into public.creators (org_id, name, email, phone, notes, tags)
    values (
      p_org_id,
      c ->> 'name',
      nullif(c ->> 'email', ''),
      nullif(c ->> 'phone', ''),
      nullif(c ->> 'notes', ''),
      coalesce(array(select jsonb_array_elements_text(c -> 'tags')), '{}')
    )
    returning id into v_creator_id;
    v_created := v_created + 1;
    v_created_ids := v_created_ids || v_creator_id;

    for a in select * from jsonb_array_elements(coalesce(c -> 'accounts', '[]'::jsonb)) loop
      insert into public.creator_accounts (creator_id, org_id, platform, handle, profile_url)
      values (v_creator_id, p_org_id, (a ->> 'platform')::public.platform, a ->> 'handle', a ->> 'profile_url')
      on conflict (org_id, platform, handle) do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        v_skipped := v_skipped || jsonb_build_object('platform', a ->> 'platform', 'handle', a ->> 'handle');
      end if;
      v_accounts := v_accounts + v_rows;
    end loop;
  end loop;

  for m in select * from jsonb_array_elements(coalesce(p_plan -> 'merges', '[]'::jsonb)) loop
    v_creator_id := (m ->> 'creator_id')::uuid;
    update public.creators set
      email = coalesce(email, nullif(m ->> 'email', '')),
      phone = coalesce(phone, nullif(m ->> 'phone', '')),
      tags = array(select distinct t from unnest(tags || coalesce(array(select jsonb_array_elements_text(m -> 'tags')), '{}')) t)
    where id = v_creator_id and org_id = p_org_id;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'creator % not found or not editable', v_creator_id;
    end if;
    v_merged := v_merged + 1;

    for a in select * from jsonb_array_elements(coalesce(m -> 'accounts', '[]'::jsonb)) loop
      insert into public.creator_accounts (creator_id, org_id, platform, handle, profile_url)
      values (v_creator_id, p_org_id, (a ->> 'platform')::public.platform, a ->> 'handle', a ->> 'profile_url')
      on conflict (org_id, platform, handle) do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        v_skipped := v_skipped || jsonb_build_object('platform', a ->> 'platform', 'handle', a ->> 'handle');
      end if;
      v_accounts := v_accounts + v_rows;
    end loop;
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'created_ids', to_jsonb(v_created_ids),
    'merged', v_merged,
    'accounts_added', v_accounts,
    'skipped_accounts', v_skipped
  );
end;
$$;

revoke execute on function public.import_creators(uuid, jsonb) from public, anon;
grant execute on function public.import_creators(uuid, jsonb) to authenticated;
