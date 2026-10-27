import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CampaignStatusBadge } from "@/components/app/deal-status";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { editableBrandIds } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import type { Campaign } from "@/lib/types";

export const metadata = { title: "Campaigns" };

type Row = Campaign & { brands: { name: string } | null; deals: Array<{ fee: string; product_value: string; status: string }> };

export default async function CampaignsPage({ searchParams }: PageProps<"/campaigns">) {
  const session = await requireSession();
  const sp = await searchParams;
  const brand = typeof sp.brand === "string" ? sp.brand : "";
  const status = typeof sp.status === "string" ? sp.status : "open";

  const supabase = await createClient();
  let query = supabase
    .from("campaigns")
    .select("*, brands(name), deals(fee, product_value, status)")
    .order("starts_on", { ascending: false, nullsFirst: true });
  if (brand) query = query.eq("brand_id", brand);
  if (status === "open") query = query.in("status", ["draft", "active"]);
  else if (status !== "all") query = query.eq("status", status);
  const [{ data, error }, { data: brands }, editable] = await Promise.all([
    query,
    supabase.from("brands").select("id, name").order("name"),
    editableBrandIds(session),
  ]);
  if (error) throw new Error(error.message);
  const campaigns = (data ?? []) as Row[];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Campaigns"
        actions={
          editable.size > 0 && (
            <Link href="/campaigns/new" className={buttonVariants()}>
              New campaign
            </Link>
          )
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <NativeSelect name="brand" defaultValue={brand} className="w-56" aria-label="Brand">
          <option value="">All brands</option>
          {(brands ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status} className="w-44" aria-label="Status">
          <option value="open">Draft + active</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </NativeSelect>
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          Filter
        </button>
      </form>

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns match">Create a campaign, then add creators to it as deals.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Creators</TableHead>
              <TableHead className="text-right">Committed cost</TableHead>
              <TableHead className="text-right">Budget</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => {
              const live = c.deals.filter((d) => d.status !== "cancelled");
              const cost = live.reduce((s, d) => s + Number(d.fee) + Number(d.product_value), 0);
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">{c.brands?.name}</div>
                    <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(c.starts_on)} – {formatDate(c.ends_on)}
                  </TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{live.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(cost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(c.budget)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
