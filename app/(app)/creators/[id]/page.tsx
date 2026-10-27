import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { HandleLink } from "@/components/app/handle-link";
import { NotAvailable } from "@/components/app/not-available";
import { DealStatusBadge } from "@/components/app/deal-status";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatDeliverables } from "@/lib/deals/deliverables";
import type { Creator, CreatorAccount, Deal } from "@/lib/types";
import { AddAccountForm, EditCreatorForm, RemoveAccountButton } from "../creator-forms";

const OAUTH_LABEL: Record<string, string> = {
  not_connected: "Not connected",
  connected: "Connected",
  expiring: "Expiring",
  expired: "Expired",
  revoked: "Revoked",
  error: "Error",
};

type DealRow = Deal & { campaigns: { id: string; name: string; brands: { name: string } | null } | null };

export default async function CreatorPage({ params }: PageProps<"/creators/[id]">) {
  const { id } = await params;
  await requireSession();
  const supabase = await createClient();
  const [{ data: creator }, { data: accounts }, { data: deals }, { data: followers }] = await Promise.all([
    supabase.from("creators").select("*").eq("id", id).maybeSingle(),
    supabase.from("creator_accounts").select("*").eq("creator_id", id).order("platform"),
    supabase.from("deals").select("*, campaigns(id, name, brands(name))").eq("creator_id", id).order("created_at", { ascending: false }),
    supabase
      .from("creator_follower_snapshots")
      .select("creator_account_id, followers, fetched_at, source, creator_accounts!inner(creator_id)")
      .eq("creator_accounts.creator_id", id)
      .order("fetched_at", { ascending: false }),
  ]);
  if (!creator) notFound();
  const c = creator as Creator;
  const latestFollowers = (accountId: string) =>
    (followers ?? []).find((f) => f.creator_account_id === accountId) as
      | { followers: number | null; fetched_at: string; source: string }
      | undefined;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={c.name}
        description={
          <Link href="/creators" className="hover:underline">
            ← All creators
          </Link>
        }
        actions={c.tags.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social accounts</CardTitle>
          <CardDescription>
            Creators who connect their own account (creator portal, coming later) give us real views and reach. Until then, only
            public numbers are available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(accounts ?? []).length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Creator connection</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(accounts as CreatorAccount[]).map((a) => {
                  const f = latestFollowers(a.id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <HandleLink platform={a.platform} handle={a.handle} long />
                      </TableCell>
                      <TableCell>
                        {f?.followers != null ? (
                          <span title={`Source: ${f.source} · ${formatDateTime(f.fetched_at)}`}>
                            {f.followers.toLocaleString()}{" "}
                            <span className="text-xs text-muted-foreground">({f.source.replace(/_/g, " ")}, {formatDateTime(f.fetched_at)})</span>
                          </span>
                        ) : (
                          <NotAvailable reason="not synced yet" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.oauth_status === "connected" ? "success" : "muted"}>{OAUTH_LABEL[a.oauth_status] ?? a.oauth_status}</Badge>
                      </TableCell>
                      <TableCell>
                        <RemoveAccountButton creatorId={c.id} accountId={a.id} handle={a.handle} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <AddAccountForm creatorId={c.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals</CardTitle>
          <CardDescription>Only brands you have access to are shown.</CardDescription>
        </CardHeader>
        <CardContent>
          {(deals ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals yet. Add this creator to a campaign to create one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand / campaign</TableHead>
                  <TableHead>Deliverables</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(deals as DealRow[]).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">{d.campaigns?.brands?.name}</div>
                      <Link href={`/campaigns/${d.campaign_id}`} className="font-medium hover:underline">
                        {d.campaigns?.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{formatDeliverables(d.deliverables) || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.fee)}</TableCell>
                    <TableCell className="font-mono text-xs">{d.discount_code ?? "—"}</TableCell>
                    <TableCell>
                      <DealStatusBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCreatorForm creator={c} />
        </CardContent>
      </Card>
    </div>
  );
}
