"use client";

import { createContext, startTransition, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import type { FormState } from "@/lib/forms";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) return <Alert variant="destructive">{state.error}</Alert>;
  if (state.fieldErrors && Object.keys(state.fieldErrors).length)
    return <Alert variant="destructive">Please fix the highlighted fields.</Alert>;
  if (state.message) return <Alert variant="success">{state.message}</Alert>;
  return null;
}

const PendingContext = createContext(false);

/**
 * A form that submits to a server action without React's automatic form reset, so a validation
 * error never wipes what the person typed. Pass `pending` from useActionState.
 */
export function ActionForm({
  action,
  pending,
  resetOn,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & {
  action: (data: FormData) => void;
  pending: boolean;
  /** Clear the form after this state reports success (for "add another" style forms). */
  resetOn?: FormState;
}) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOn?.ok) ref.current?.reset();
  }, [resetOn]);
  return (
    <form
      ref={ref}
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <PendingContext value={pending}>{children}</PendingContext>
    </form>
  );
}

export function SubmitButton({ children, pendingText = "Saving…", ...props }: ButtonProps & { pendingText?: string }) {
  const formStatus = useFormStatus();
  const pending = useContext(PendingContext) || formStatus.pending;
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
