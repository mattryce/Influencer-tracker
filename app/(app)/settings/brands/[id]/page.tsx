import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthDetail } from "@/components/app/health-badge";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { Brand, IntegrationHealth } from "@/lib/types";
import { AddBrandMemberForm, EditBrandForm } from "../brand-forms";
import { RemoveMemberButton } from "./remove-member-button";

interface MemberRow {
  user_id: string;
  role: "editor" | "viewer";
  profiles: { email: string; full_name: string | null } | null;
}

export default async function BrandPage({ params }: PageProps<"/settings/brands/[id]">) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const isAdmin = session.org.role === "admin";

  const [{ data: brand }, { data: health }, { data: members }, { data: orgMembers }] = await Promise.all([
    supabase.from("brands").select("*").eq("id", id).maybeSingle(),
    supabase.from("integration_health").select("*").eq("brand_id", id),
    supabase.from("brand_members").select("user_id, role, profiles(email, full_name)").eq("brand_id", id),
    isAdmin
      ? supabase.from("org_members").select("user_id, role, profiles(email, full_name)").eq("org_id", session.org.id)
      : Promise.resolve({ data: [] }),
  ]);
  if (!brand) notFound();
  const b = brand as Brand;
  const h = (health ?? []) as IntegrationHealth[];
  const memberRows = (members ?? []) as unknown as MemberRow[];
  const memberIds = new Set(memberRows.map((m) => m.user_id));
  const candidates = ((orgMembers ?? []) as unknown as Array<Omit<MemberRow, "role"> & { role: string }>)
    .filter((m) => m.role !== "admin" && !memberIds.has(m.user_id))
    .map((m) => ({ id: m.user_id, label: m.profiles?.full_name || m.profiles?.email || m.user_id }));

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={b.name}
        description={
          <Link href="/settings/brands" className="hover:underline">
            ← All brands
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instagram</CardTitle>
            <CardDescription>
              {b.instagram_username ? `@${b.instagram_username}` : "Brand Instagram Business account — captures tags, @mentions and Story mentions."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <HealthDetail health={h.find((x) => x.integration === "instagram_graph") ?? null} />
            <p className="text-xs text-muted-foreground">
              Connecting Instagram is part of the next build phase (it needs Marcosm&apos;s Meta developer app). Nothing is being
              captured for this brand yet.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shopify</CardTitle>
            <CardDescription>{b.shopify_store_domain ?? "Store address not set yet."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <HealthDetail health={h.find((x) => x.integration === "shopify") ?? null} />
            <p className="text-xs text-muted-foreground">
              Order attribution and automatic discount codes arrive in the Shopify phase. Until then, no revenue is tracked.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand details</CardTitle>
          {!isAdmin && <CardDescription>Only admins can change brand details.</CardDescription>}
        </CardHeader>
        <CardContent>
          <EditBrandForm brand={b} canEdit={isAdmin} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who can see this brand</CardTitle>
          <CardDescription>Admins always see every brand. Other teammates only see brands listed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {memberRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Only admins have access right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Access</TableHead>
                  {isAdmin && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberRows.map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell>{m.profiles?.full_name || m.profiles?.email}</TableCell>
                    <TableCell>
                      <Badge variant={m.role === "editor" ? "secondary" : "outline"}>{m.role === "editor" ? "Can edit" : "View only"}</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <RemoveMemberButton brandId={b.id} userId={m.user_id} name={m.profiles?.email ?? "this person"} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {isAdmin && <AddBrandMemberForm brandId={b.id} candidates={candidates} />}
        </CardContent>
      </Card>
    </div>
  );
}
