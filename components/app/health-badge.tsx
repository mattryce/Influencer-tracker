import { Badge } from "@/components/ui/badge";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { HealthStatus, IntegrationHealth } from "@/lib/types";

const LABELS: Record<HealthStatus, { label: string; variant: "success" | "warning" | "danger" | "muted" }> = {
  connected: { label: "Connected", variant: "success" },
  token_expiring: { label: "Token expiring", variant: "warning" },
  rate_limited: { label: "Rate-limited", variant: "warning" },
  broken: { label: "Broken", variant: "danger" },
  not_connected: { label: "Not connected", variant: "muted" },
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  const { label, variant } = LABELS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

/** Status + last successful sync + last error, so nobody has to guess whether data is fresh. */
export function HealthDetail({ health }: { health: IntegrationHealth | null }) {
  if (!health) {
    return (
      <div className="space-y-1 text-sm">
        <HealthBadge status="not_connected" />
        <p className="text-muted-foreground">No sync has ever run for this connection.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1 text-sm">
      <HealthBadge status={health.status} />
      <p className="text-muted-foreground">
        Last successful sync:{" "}
        <span title={formatDateTime(health.last_success_at)}>{timeAgo(health.last_success_at)}</span>
      </p>
      {health.token_expires_at && (
        <p className="text-muted-foreground">Token expires {formatDateTime(health.token_expires_at)}</p>
      )}
      {health.last_error && health.status !== "connected" && (
        <p className="text-red-700 dark:text-red-400">Last error: {health.last_error}</p>
      )}
    </div>
  );
}
