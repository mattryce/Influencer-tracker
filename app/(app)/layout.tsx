import { Suspense } from "react";
import { Nav, NavLinks } from "@/components/app/nav";
import { requireSession } from "@/lib/session";

async function UserBox() {
  const session = await requireSession();
  return (
    <div className="space-y-2 border-t pt-4 text-xs text-muted-foreground">
      <div className="truncate font-medium text-foreground">{session.email}</div>
      <div>
        {session.org.name} · {session.org.role === "admin" ? "Admin" : "Member"}
      </div>
      <form action="/auth/signout" method="post">
        <button type="submit" className="underline-offset-4 hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b bg-muted/30 p-4 md:w-56 md:border-r md:border-b-0">
        <div className="px-3 text-sm font-semibold">Influencer Tracker</div>
        <Suspense fallback={<NavLinks pathname={null} />}>
          <Nav />
        </Suspense>
        <div className="mt-auto hidden md:block">
          <Suspense fallback={<div className="h-16" />}>
            <UserBox />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
