import { Badge } from "@/components/ui/badge";

const DEAL: Record<string, { label: string; variant: "success" | "secondary" | "muted" | "outline" }> = {
  proposed: { label: "Proposed", variant: "outline" },
  active: { label: "Active", variant: "success" },
  completed: { label: "Completed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "muted" },
};

const CAMPAIGN: Record<string, { label: string; variant: "success" | "secondary" | "muted" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  active: { label: "Active", variant: "success" },
  completed: { label: "Completed", variant: "secondary" },
  archived: { label: "Archived", variant: "muted" },
};

export function DealStatusBadge({ status }: { status: string }) {
  const s = DEAL[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function CampaignStatusBadge({ status }: { status: string }) {
  const s = CAMPAIGN[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
