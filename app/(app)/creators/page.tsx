import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { HandleLink } from "@/components/app/handle-link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { Creator, CreatorAccount } from "@/lib/types";

export const metadata = { title: "Creators" };

type Row = Creator & { creator_accounts: CreatorAccount[]; deals: Array<{ status: string }> };

export default async function CreatorsPage({ searchParams }: PageProps<"/creators">) {
  await requireSession();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tag = typeof sp.tag === "string" ? sp.tag.trim().toLowerCase() : "";

  const supabase = await createClient();
  let query = supabase
    .from("creators")
    .select("*, creator_accounts(id, platform, handle), deals(status)")
    .order("name")
    .limit(500);
  if (tag) query = query.contains("tags", [tag]);
  if (q) {
    const term = q.replace(/^@/, "").replace(/[%,()]/g, " ");
    // Match name/email, or any handle (looked up separately because filters on embedded rows don't widen results).
    const { data: byHandle } = await supabase.from("creator_accounts").select("creator_id").ilike("handle", `%${term}%`).limit(500);
    const ids = (byHandle ?? []).map((r) => r.creator_id);
    const ors = [`name.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
    query = query.or(ors.join(","));
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const creators = (data ?? []) as Row[];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Creators"
        description="Everyone Marcosm works with, across all brands."
        actions={
          <>
            <Link href="/creators/import" className={buttonVariants({ variant: "outline" })}>
              Import CSV
            </Link>
            <Link href="/creators/new" className={buttonVariants()}>
              Add creator
            </Link>
          </>
        }
      />

      <form className="mb-4 flex max-w-md gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Search name, email or @handle" aria-label="Search creators" />
        {tag && <input type="hidden" name="tag" value={tag} />}
      </form>
      {tag && (
        <p className="mb-4 text-sm">
          Tagged <Badge variant="secondary">{tag}</Badge>{" "}
          <Link href={q ? `/creators?q=${encodeURIComponent(q)}` : "/creators"} className="text-muted-foreground hover:underline">
            clear
          </Link>
        </p>
      )}

      {creators.length === 0 ? (
        <EmptyState title={q || tag ? "No creators match" : "No creators yet"}>
          {q || tag ? "Try a different search." : "Add creators one at a time or import a spreadsheet."}
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Accounts</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Active deals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creators.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/creators/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.creator_accounts.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No accounts</span>
                    ) : (
                      c.creator_accounts.map((a) => <HandleLink key={a.id} platform={a.platform} handle={a.handle} />)
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <Link key={t} href={`/creators?tag=${encodeURIComponent(t)}`}>
                        <Badge variant="secondary">{t}</Badge>
                      </Link>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.deals.filter((d) => d.status === "active").length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {creators.length === 500 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 500. Search to narrow down.</p>}
    </div>
  );
}
