"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { initialFormState } from "@/lib/forms";
import { sendMagicLink } from "./actions";

export function LoginForm({ next, error }: { next: string; error?: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@marcosm.co" />
      </div>
      {error && !state.message && !state.error && <Alert variant="destructive">{error}</Alert>}
      {state.error && <Alert variant="destructive">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
