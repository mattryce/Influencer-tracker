"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/app/form-bits";
import { initialFormState } from "@/lib/forms";
import { inviteTeammate, removeTeammate, revokeInvite, setOrgRole } from "./actions";

export function InviteForm({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const [state, action, actionPending] = useActionState(inviteTeammate, initialFormState);
  const [orgRole, setRole] = useState("member");
  return (
    <ActionForm action={action} pending={actionPending} resetOn={state} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" required placeholder="name@marcosm.co" />
        </Field>
        <Field
          label="Role"
          htmlFor="org_role"
          hint={orgRole === "admin" ? "Admins see every brand and manage the team." : "Members only see the brands you pick."}
        >
          <NativeSelect id="org_role" name="org_role" value={orgRole} onChange={(e) => setRole(e.target.value)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </NativeSelect>
        </Field>
      </div>
      {orgRole === "member" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brands" htmlFor="brand_ids" error={state.fieldErrors?.brand_ids}>
            <div id="brand_ids" className="grid max-h-48 gap-1.5 overflow-y-auto rounded-md border p-3">
              {brands.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="brand_ids" value={b.id} className="size-4" />
                  {b.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Access to those brands" htmlFor="brand_role">
            <NativeSelect id="brand_role" name="brand_role" defaultValue="editor">
              <option value="editor">Can edit (campaigns, deals, creators)</option>
              <option value="viewer">View only (e.g. content team)</option>
            </NativeSelect>
          </Field>
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton pendingText="Sending…">Send invite</SubmitButton>
    </ActionForm>
  );
}

export function MemberActions({ userId, role, email }: { userId: string; role: "admin" | "member"; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(() => setOrgRole(userId, role === "admin" ? "member" : "admin"))}
      >
        {role === "admin" ? "Make member" : "Make admin"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => confirm(`Remove ${email} from the team?`) && run(() => removeTeammate(userId))}
      >
        Remove
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => revokeInvite(inviteId))}>
      {pending ? "Revoking…" : "Revoke"}
    </Button>
  );
}
