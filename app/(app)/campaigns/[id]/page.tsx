import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusBadge, DealStatusBadge } from "@/components/app/deal-status";
import { DiscountStatus } from "@/components/app/discount-status";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { editableBrandIds } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import { formatDeliverables, totalDeliverables } from "@/lib/deals/deliverables";
import type { Campaign, Deal } from "@/lib/types";
import { EditCampaignForm, NewDealForm } from "../campaign-forms";

type DealRow = Deal & { creators: { id: string; name: string } | null };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: campaign } = await supabase.from("campaigns").select("*, brands(id, name, shopify_store_domain)").eq("id", id).maybeSingle();
  if (!campaign) notFound();
  const c = campaign as Campaign & { brands: { id: string; name: string; shopify_store_domain: string | null } };

  const [{ data: deals }, { data: creators }, { data: shopifyHealth }, editable] = await Promise.all([
    supabase.from("deals").select("*, creators(id, name)").eq("campaign_id", id).order("created_at"),
    supabase.from("creators").select("id, name, creator_accounts(platform, handle)").order("name").limit(2000),
    supabase.from("integration_health").select("status").eq("brand_id", c.brand_id).eq("integration", "shopify").maybeSingle(),
    editableBrandIds(session),
  ]);
  const canEdit = editable.has(c.brand_id);
  const shopifyConnected = shopifyHealth?.status === "connected" || shopifyHealth?.status === "token_expiring";
  const rows = (deals ?? []) as DealRow[];
  const live = rows.filter((d) => d.status !== "cancelled");
  const fees = live.reduce((s, d) => s + Number(d.fee), 0);
  const product = live.reduce((s, d) => s + Number(d.product_value), 0);
  const owed = live.reduce((s, d) => s + totalDeliverables(d.deliverables), 0);
  const inCampaign = new Set(rows.map((d) => d.creator_id));
  const creatorOptions = ((creators ?? []) as Array<{ id: string; name: string; creator_accounts: Array<{ platform: string; handle: string }> }>)
    .filter((cr) => !inCampaign.has(cr.id))
    .map((cr) => ({
      id: cr.id,
      name: cr.name,
      handle: (cr.creator_accounts.find((a) => a.platform === "instagram") ?? cr.creator_accounts[0])?.handle ?? null,
    }));

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={c.name}
        description={
          <>
            <Link href="/campaigns" className="hover:underline">
              ← Campaigns
            </Link>{" "}
            · {c.brands.name} · {formatDate(c.starts_on)} – {formatDate(c.ends_on)}
          </>
        }
        actions={<CampaignStatusBadge status={c.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Budget" value={formatMoney(c.budget)} />
        <Stat
          label="Creator fees committed"
          value={formatMoney(fees)}
          hint={c.budget ? `${Math.round((fees / Number(c.budget)) * 100)}% of budget` : undefined}
        />
        <Stat label="Product value sent" value={formatMoney(product)} hint="Shown separately until we decide whether it counts toward ROI." />
        <Stat label="Deliverables owed" value={String(owed)} hint="Posts are matched to deals once Instagram capture is live." />
      </div>

      {(c.required_hashtags.length > 0 || c.required_mentions.length > 0) && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <span className="text-muted-foreground">Posts must include:</span>
          {c.required_hashtags.map((t) => (
            <Badge key={`h${t}`} variant="outline">
              #{t}
            </Badge>
          ))}
          {c.required_mentions.map((t) => (
            <Badge key={`m${t}`} variant="outline">
              @{t}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals</CardTitle>
          <CardDescription>One deal per creator in this campaign.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No creators in this campaign yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Deliverables</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Product</TableHead>
                  <TableHead>Code / UTM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link href={`/creators/${d.creator_id}`} className="font-medium hover:underline">
                        {d.creators?.name}
                      </Link>
                      {d.usage_rights && <div className="text-xs text-muted-foreground">Usage rights</div>}
                    </TableCell>
                    <TableCell className="text-sm">{formatDeliverables(d.deliverables) || "—"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(d.due_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.fee)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.product_value)}</TableCell>
                    <TableCell className="space-y-1">
                      <div className="font-mono text-xs">{d.discount_code ?? "—"}</div>
                      {d.utm_tag && <div className="font-mono text-xs text-muted-foreground">utm: {d.utm_tag}</div>}
                      <DiscountStatus status={d.shopify_discount_status} error={d.shopify_discount_error} shopifyConnected={shopifyConnected} />
                    </TableCell>
                    <TableCell>
                      <DealStatusBadge status={d.status} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/campaigns/${c.id}/deals/${d.id}`} className="text-sm hover:underline">
                        {canEdit ? "Edit" : "View"}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {canEdit && (
            <div className="rounded-lg border p-4">
              <h3 className="mb-4 text-sm font-semibold">Add a creator to this campaign</h3>
              <NewDealForm campaignId={c.id} creators={creatorOptions} shopifyConnected={shopifyConnected} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditCampaignForm campaign={c} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
