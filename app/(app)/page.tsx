import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthBadge } from "@/components/app/health-badge";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { formatDate, formatMoney } from "@/lib/format";
import { formatDeliverables } from "@/lib/deals/deliverables";
import type { Deal, HealthStatus } from "@/lib/types";

export const metadata = { title: "Overview" };

type DealRow = Pick<Deal, "id" | "brand_id" | "campaign_id" | "status" | "fee" | "due_date" | "deliverables"> & {
  creators: { name: string } | null;
  campaigns: { name: string; status: string } | null;
};

export default async function OverviewPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: brands }, { data: deals }, { data: health }, { data: alerts }] = await Promise.all([
    supabase.from("brands").select("id, name").order("name"),
    supabase
      .from("deals")
      .select("id, brand_id, campaign_id, status, fee, due_date, deliverables, creators(name), campaigns(name, status)")
      .in("status", ["proposed", "active"]),
    supabase.from("integration_health").select("brand_id, integration, status"),
    supabase.from("alerts").select("id, title, body, severity, created_at").is("resolved_at", null).order("created_at", { ascending: false }).limit(10),
  ]);
  const dealRows = (deals ?? []) as unknown as DealRow[];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = dealRows
    .filter((d) => d.status === "active" && d.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 10);
  const healthOf = (brandId: string, integration: string): HealthStatus =>
    ((health ?? []).find((h) => h.brand_id === brandId && h.integration === integration)?.status as HealthStatus) ?? "not_connected";

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Overview" description={`${session.org.name} · ${(brands ?? []).length} brands you can see`} />

      {(alerts ?? []).length > 0 && (
        <div className="space-y-2">
          {(alerts ?? []).map((a) => (
            <Alert key={a.id} variant={a.severity === "critical" ? "destructive" : "warning"}>
              <span className="font-medium">{a.title}</span>
              {a.body && <span> — {a.body}</span>}
            </Alert>
          ))}
        </div>
      )}

      {(brands ?? []).length === 0 ? (
        <EmptyState title="No brands yet">
          {session.org.role === "admin" ? (
            <Link href="/settings/brands" className="underline">
              Add your first brand
            </Link>
          ) : (
            "Ask an admin to give you access to a brand."
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(brands ?? []).map((b) => {
            const bd = dealRows.filter((d) => d.brand_id === b.id);
            const active = bd.filter((d) => d.status === "active");
            const campaigns = new Set(bd.filter((d) => d.campaigns?.status === "active").map((d) => d.campaign_id));
            return (
              <Card key={b.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    <Link href={`/campaigns?brand=${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {campaigns.size} active campaign{campaigns.size === 1 ? "" : "s"} · {active.length} active deal{active.length === 1 ? "" : "s"} ·{" "}
                    {formatMoney(active.reduce((s, d) => s + Number(d.fee), 0))} in fees
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Instagram <HealthBadge status={healthOf(b.id, "instagram_graph")} />
                  </span>
                  <span className="flex items-center gap-1">
                    Shopify <HealthBadge status={healthOf(b.id, "shopify")} />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming deliverables</CardTitle>
          <CardDescription>Active deals by due date. Post tracking (done vs. owed) arrives with Instagram capture.</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active deals with a due date.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Deliverables</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className={d.due_date! < today ? "font-medium text-red-700 dark:text-red-400" : ""}>
                      {formatDate(d.due_date)}
                      {d.due_date! < today && " (overdue)"}
                    </TableCell>
                    <TableCell>{d.creators?.name}</TableCell>
                    <TableCell>
                      <Link href={`/campaigns/${d.campaign_id}`} className="hover:underline">
                        {d.campaigns?.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{formatDeliverables(d.deliverables) || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
