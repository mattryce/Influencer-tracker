import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { editableBrandIds } from "@/lib/access";
import type { Deal } from "@/lib/types";
import { EditDealForm } from "../../../campaign-forms";

export default async function DealPage({ params }: PageProps<"/campaigns/[id]/deals/[dealId]">) {
  const { id, dealId } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("*, creators(name), campaigns(name)")
    .eq("id", dealId)
    .eq("campaign_id", id)
    .maybeSingle();
  if (!deal) notFound();
  const d = deal as Deal & { creators: { name: string } | null; campaigns: { name: string } | null };
  const [editable, { data: health }] = await Promise.all([
    editableBrandIds(session),
    supabase.from("integration_health").select("status").eq("brand_id", d.brand_id).eq("integration", "shopify").maybeSingle(),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${d.creators?.name} — ${d.campaigns?.name}`}
        description={
          <Link href={`/campaigns/${id}`} className="hover:underline">
            ← Back to campaign
          </Link>
        }
      />
      <Card>
        <CardContent className="pt-5">
          <EditDealForm
            campaignId={id}
            deal={d}
            canEdit={editable.has(d.brand_id)}
            shopifyConnected={health?.status === "connected" || health?.status === "token_expiring"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
