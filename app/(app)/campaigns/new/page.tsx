import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { editableBrandIds } from "@/lib/access";
import { NewCampaignForm } from "../campaign-forms";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage({ searchParams }: PageProps<"/campaigns/new">) {
  const session = await requireSession();
  await searchParams;
  const supabase = await createClient();
  const [{ data: brands }, editable] = await Promise.all([supabase.from("brands").select("id, name").order("name"), editableBrandIds(session)]);
  const options = (brands ?? []).filter((b) => editable.has(b.id));

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New campaign"
        description={
          <Link href="/campaigns" className="hover:underline">
            ← Campaigns
          </Link>
        }
      />
      {options.length === 0 ? (
        <EmptyState title="You can't create campaigns yet">You need edit access to at least one brand. Ask an admin.</EmptyState>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <NewCampaignForm brands={options} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
