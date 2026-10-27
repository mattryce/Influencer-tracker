-- Bootstrap the Marcosm organization and its first admin.
-- Matt becomes org admin automatically the first time he signs in with this email
-- (see private.handle_new_user). Everyone else is invited from Settings → Team.
insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Marcosm LLC')
on conflict (id) do nothing;

insert into public.org_invites (org_id, email, org_role)
values ('00000000-0000-4000-8000-000000000001', 'mattryce@marcosm.co', 'admin')
on conflict (org_id, email) do nothing;
