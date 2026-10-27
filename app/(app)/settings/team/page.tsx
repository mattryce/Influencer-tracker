import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { InviteForm, MemberActions, RevokeInviteButton } from "./team-forms";

export const metadata = { title: "Team" };

interface Member {
  user_id: string;
  role: "admin" | "member";
  created_at: string;
  profiles: { email: string; full_name: string | null } | null;
}

export default async function TeamPage() {
  const session = await requireSession();
  const isAdmin = session.org.role === "admin";
  const supabase = await createClient();
  const [{ data: members, error }, { data: brands }, { data: brandMembers }, { data: invites }] = await Promise.all([
    supabase.from("org_members").select("user_id, role, created_at, profiles(email, full_name)").eq("org_id", session.org.id),
    supabase.from("brands").select("id, name").eq("org_id", session.org.id).order("name"),
    supabase.from("brand_members").select("user_id, brand_id, role"),
    isAdmin
      ? supabase.from("org_invites").select("*").eq("org_id", session.org.id).is("accepted_at", null).order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  if (error) throw new Error(error.message);
  const brandName = new Map((brands ?? []).map((b) => [b.id, b.name]));
  const rows = ((members ?? []) as unknown as Member[]).sort((a, b) =>
    (a.profiles?.email ?? "").localeCompare(b.profiles?.email ?? ""),
  );

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Team" description="Who can sign in, and which brands they can see." />

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a teammate</CardTitle>
            <CardDescription>They&apos;ll get an email with a sign-in link. No passwords.</CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm brands={brands ?? []} />
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Brands</TableHead>
            {isAdmin && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => {
            const access = (brandMembers ?? []).filter((bm) => bm.user_id === m.user_id);
            return (
              <TableRow key={m.user_id}>
                <TableCell>
                  <div className="font-medium">{m.profiles?.full_name || m.profiles?.email}</div>
                  {m.profiles?.full_name && <div className="text-xs text-muted-foreground">{m.profiles.email}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant={m.role === "admin" ? "default" : "secondary"}>{m.role === "admin" ? "Admin" : "Member"}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {m.role === "admin"
                    ? "All brands"
                    : access.length === 0
                      ? <span className="text-muted-foreground">None</span>
                      : access.map((a) => `${brandName.get(a.brand_id) ?? "?"}${a.role === "viewer" ? " (view)" : ""}`).join(", ")}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {m.user_id !== session.userId && (
                      <MemberActions userId={m.user_id} role={m.role} email={m.profiles?.email ?? ""} />
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {isAdmin && (invites ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invites</CardTitle>
            <CardDescription>These people haven&apos;t signed in yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {(invites ?? []).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.org_role === "admin"
                        ? "Admin"
                        : (inv.brand_ids as string[]).map((id) => brandName.get(id) ?? "?").join(", ")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">Invited {formatDate(inv.created_at)}</TableCell>
                    <TableCell>
                      <RevokeInviteButton inviteId={inv.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
