"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/app/form-bits";
import { initialFormState } from "@/lib/forms";
import { PLATFORM_LABELS, PLATFORMS, type Creator } from "@/lib/types";
import { addCreatorAccount, createCreator, removeCreatorAccount, updateCreator } from "./actions";

function CreatorFields({ creator, errors }: { creator?: Creator; errors?: Record<string, string> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="name" error={errors?.name}>
        <Input id="name" name="name" required defaultValue={creator?.name} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors?.email}>
        <Input id="email" name="email" type="email" defaultValue={creator?.email ?? ""} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={creator?.phone ?? ""} />
      </Field>
      <Field label="Tags" htmlFor="tags" hint="Comma-separated, e.g. diesel, trucks, ugc">
        <Input id="tags" name="tags" defaultValue={creator?.tags.join(", ") ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={creator?.notes ?? ""} />
        </Field>
      </div>
    </div>
  );
}

export function NewCreatorForm() {
  const [state, action, actionPending] = useActionState(createCreator, initialFormState);
  return (
    <ActionForm action={action} pending={actionPending} className="space-y-6">
      <CreatorFields errors={state.fieldErrors} />
      <div>
        <h2 className="mb-1 text-sm font-semibold">Social accounts</h2>
        <p className="mb-3 text-xs text-muted-foreground">Paste a handle or profile link. Used to match posts and avoid duplicates.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLATFORMS.map((p) => (
            <Field key={p} label={PLATFORM_LABELS[p]} htmlFor={p} error={state.fieldErrors?.[p]}>
              <Input id={p} name={p} placeholder="@handle or link" />
            </Field>
          ))}
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Adding…">Add creator</SubmitButton>
    </ActionForm>
  );
}

export function EditCreatorForm({ creator }: { creator: Creator }) {
  const [state, action, actionPending] = useActionState(updateCreator.bind(null, creator.id), initialFormState);
  return (
    <ActionForm action={action} pending={actionPending} className="space-y-4">
      <CreatorFields creator={creator} errors={state.fieldErrors} />
      <FormMessage state={state} />
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}

export function AddAccountForm({ creatorId }: { creatorId: string }) {
  const [state, action, actionPending] = useActionState(addCreatorAccount.bind(null, creatorId), initialFormState);
  return (
    <ActionForm action={action} pending={actionPending} resetOn={state} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <Field label="Platform" htmlFor="platform" error={state.fieldErrors?.platform}>
          <NativeSelect id="platform" name="platform" defaultValue="instagram">
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Handle or profile link" htmlFor="handle" error={state.fieldErrors?.handle}>
          <Input id="handle" name="handle" required placeholder="@handle" />
        </Field>
        <SubmitButton pendingText="Adding…">Add account</SubmitButton>
      </div>
      {!state.fieldErrors && <FormMessage state={state} />}
    </ActionForm>
  );
}

export function RemoveAccountButton({ creatorId, accountId, handle }: { creatorId: string; accountId: string; handle: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => confirm(`Remove @${handle} from this creator?`) && start(() => removeCreatorAccount(creatorId, accountId))}
    >
      Remove
    </Button>
  );
}
