-- Local development seed data. FAKE creators, campaigns and deals — never load into production.
-- The organization + Matt's admin invite come from the bootstrap migration.
-- Sign in locally as any of the emails below (Inbucket at http://127.0.0.1:54324 catches the magic link).

-- Team invites (applied on first login)
insert into public.org_invites (org_id, email, org_role, brand_ids, brand_role) values
  ('00000000-0000-4000-8000-000000000001', 'cece@example.com', 'member',
   array['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002']::uuid[], 'editor'),
  ('00000000-0000-4000-8000-000000000001', 'content@example.com', 'member',
   array['10000000-0000-4000-8000-000000000001']::uuid[], 'viewer')
on conflict (org_id, email) do nothing;

insert into public.brands (id, org_id, name, slug, website_url) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Hot Shot''s Secret', 'hot-shots-secret', 'https://hotshotsecret.com'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Stainless Diesel', 'stainless-diesel', null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'D&J Precision Machine', 'dj-precision-machine', null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Canadian Diesel Online', 'canadian-diesel-online', null),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'CNC Fabrication', 'cnc-fabrication', null),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'MPMC', 'mpmc', null),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'Firepunk Diesel', 'firepunk-diesel', null)
on conflict (id) do nothing;

insert into public.creators (id, org_id, name, email, phone, tags, notes, rate_card) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Jake Torque (FAKE)', 'jake@example.com', '555-0101', '{diesel,trucks}', 'Seed data', '{"instagram_reel": 750}'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Rosa Builds (FAKE)', 'rosa@example.com', null, '{fabrication}', 'Seed data', '{"youtube_video": 1500}'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Midwest Mud Co (FAKE)', null, null, '{offroad,ugc}', 'Seed data', '{}'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Tina Tunes Diesel (FAKE)', 'tina@example.com', '555-0104', '{diesel}', 'Seed data', '{"tiktok_video": 400}')
on conflict (id) do nothing;

insert into public.creator_accounts (creator_id, org_id, platform, handle, profile_url) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'instagram', 'jaketorque_fake', 'https://www.instagram.com/jaketorque_fake/'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'tiktok', 'jaketorque_fake', 'https://www.tiktok.com/@jaketorque_fake'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'youtube', 'rosabuilds_fake', 'https://www.youtube.com/@rosabuilds_fake'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'instagram', 'rosabuilds_fake', 'https://www.instagram.com/rosabuilds_fake/'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'instagram', 'midwestmud_fake', 'https://www.instagram.com/midwestmud_fake/'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'tiktok', 'tinatunes_fake', 'https://www.tiktok.com/@tinatunes_fake')
on conflict do nothing;

insert into public.campaigns (id, brand_id, name, status, starts_on, ends_on, budget, goal, required_hashtags, required_mentions) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Winter Treatment Push (FAKE)', 'active',
   current_date - 14, current_date + 30, 5000, 'Drive code sales for winter diesel treatment', '{hotshotsecret}', '{hotshotsecret}'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Exhaust Launch (FAKE)', 'draft',
   current_date + 7, current_date + 60, 3000, 'Awareness for new exhaust line', '{stainlessdiesel}', '{stainlessdiesel}')
on conflict (id) do nothing;

insert into public.deals (campaign_id, brand_id, creator_id, status, fee, product_value, deliverables, due_date, discount_code, utm_tag, usage_rights) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'active', 750, 120,
   '[{"platform":"instagram","type":"reel","count":2},{"platform":"instagram","type":"story","count":3}]', current_date + 10, 'JAKE15', 'jaketorque', true),
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'active', 400, 60,
   '[{"platform":"tiktok","type":"video","count":2}]', current_date + 5, 'TINA10', 'tinatunes', false),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'proposed', 1500, 900,
   '[{"platform":"youtube","type":"video","count":1}]', current_date + 45, 'ROSA20', 'rosabuilds', true)
on conflict do nothing;
