"use client";

import { useActionState } from "react";
import { Input, NativeSelect } from "@/components/ui/input";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/app/form-bits";
import { initialFormState } from "@/lib/forms";
import type { Brand } from "@/lib/types";
import { createBrand, setBrandMember, updateBrand } from "./actions";

export function CreateBrandForm() {
  const [state, action, actionPending] = useActionState(createBrand, initialFormState);
  return (
    <ActionForm action={action} pending={actionPending} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="Brand name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" required placeholder="e.g. Firepunk Diesel" />
      </Field>
      <Field label="Website (optional)" htmlFor="website_url" error={state.fieldErrors?.website_url}>
        <Input id="website_url" name="website_url" placeholder="firepunkdiesel.com" />
      </Field>
      <SubmitButton pendingText="Creating…">Add brand</SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </ActionForm>
  );
}

export function EditBrandForm({ brand, canEdit }: { brand: Brand; canEdit: boolean }) {
  const [state, action, actionPending] = useActionState(updateBrand.bind(null, brand.id), initialFormState);
  return (
    <ActionForm action={action} pending={actionPending} className="space-y-4">
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={brand.name} required />
        </Field>
        <Field label="Website" htmlFor="website_url" error={state.fieldErrors?.website_url}>
          <Input id="website_url" name="website_url" defaultValue={brand.website_url ?? ""} />
        </Field>
        <Field
          label="Shopify store address"
          htmlFor="shopify_store_domain"
          error={state.fieldErrors?.shopify_store_domain}
          hint="The .myshopify.com address (find it in Shopify admin → Settings → Domains)."
        >
          <Input
            id="shopify_store_domain"
            name="shopify_store_domain"
            defaultValue={brand.shopify_store_domain ?? ""}
            placeholder="yourstore.myshopify.com"
          />
        </Field>
      </fieldset>
      <FormMessage state={state} />
      {canEdit && <SubmitButton>Save brand</SubmitButton>}
    </ActionForm>
  );
}

export function AddBrandMemberForm({
  brandId,
  candidates,
}: {
  brandId: string;
  candidates: Array<{ id: string; label: string }>;
}) {
  const [state, action, actionPending] = useActionState(setBrandMember.bind(null, brandId), initialFormState);
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">Everyone on the team already has access. Invite more people from Team.</p>;
  }
  return (
    <ActionForm action={action} pending={actionPending} resetOn={state} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Field label="Teammate" htmlFor="user_id">
          <NativeSelect id="user_id" name="user_id" required defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Access" htmlFor="role">
          <NativeSelect id="role" name="role" defaultValue="editor">
            <option value="editor">Can edit</option>
            <option value="viewer">View only</option>
          </NativeSelect>
        </Field>
        <SubmitButton>Give access</SubmitButton>
      </div>
      <FormMessage state={state} />
    </ActionForm>
  );
}
