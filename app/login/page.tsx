import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Request a new one.",
};

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/";
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? sp.error) : undefined;
  return <LoginForm next={next} error={error} />;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Influencer Tracker</CardTitle>
          <CardDescription>Marcosm team sign-in. We&apos;ll email you a one-time link — no password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <Form searchParams={props.searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
