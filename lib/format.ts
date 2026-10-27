const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function formatMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return usd.format(Number(v));
}

export function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  // Plain dates (YYYY-MM-DD) are calendar dates; don't shift them by timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(v: string | null | undefined, now = new Date()): string {
  if (!v) return "never";
  const s = Math.round((now.getTime() - new Date(v).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
