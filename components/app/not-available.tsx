/** The one way the app shows a missing number: never 0, always a reason. */
export function NotAvailable({ reason }: { reason: string }) {
  return (
    <span className="text-xs text-muted-foreground" title={reason}>
      Not available — {reason}
    </span>
  );
}
