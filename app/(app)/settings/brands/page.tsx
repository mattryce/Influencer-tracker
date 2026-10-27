import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthBadge } from "@/components/app/health-badge";
import { EmptyState, PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { Brand, IntegrationHealth } from "@/lib/types";
import { CreateBrandForm } from "./brand-forms";

export const metadata = { title: "Brands" };

export default async function BrandsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const [{ data: brands, error }, { data: health }] = await Promise.all([
    supabase.from("brands").select("*").order("name"),
    supabase.from("integration_health").select("*").not("brand_id", "is", null),
  ]);
  if (error) throw new Error(error.message);
  const healthFor = (brandId: string, integration: string) =>
    (health as IntegrationHealth[] | null)?.find((h) => h.brand_id === brandId && h.integration === integration)?.status ??
    "not_connected";

  return (
    <div className="max-w-5xl">
      <PageHeader title="Brands" description="Each brand has its own campaigns, Instagram account and Shopify store." />

      {session.org.role === "admin" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Add a brand</CardTitle>
            <CardDescription>You can connect Instagram and Shopify after it&apos;s created.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateBrandForm />
          </CardContent>
        </Card>
      )}

      {(brands ?? []).length === 0 ? (
        <EmptyState title="No brands yet">
          {session.org.role === "admin" ? "Add your first brand above." : "Ask an admin to give you access to a brand."}
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead>Shopify</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(brands as Brand[]).map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Link href={`/settings/brands/${b.id}`} className="font-medium hover:underline">
                    {b.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <HealthBadge status={healthFor(b.id, "instagram_graph")} />
                </TableCell>
                <TableCell>
                  <HealthBadge status={healthFor(b.id, "shopify")} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
