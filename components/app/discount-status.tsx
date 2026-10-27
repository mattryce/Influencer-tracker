import { Badge } from "@/components/ui/badge";

export function DiscountStatus({
  status,
  error,
  shopifyConnected,
}: {
  status: "not_requested" | "pending" | "created" | "failed";
  error?: string | null;
  shopifyConnected: boolean;
}) {
  switch (status) {
    case "not_requested":
      return null;
    case "pending":
      return shopifyConnected ? (
        <Badge variant="warning">Creating in Shopify…</Badge>
      ) : (
        <Badge variant="warning" title="The code will be created once this brand's Shopify store is connected.">
          Waiting for Shopify connection
        </Badge>
      );
    case "created":
      return <Badge variant="success">Live in Shopify</Badge>;
    case "failed":
      return (
        <Badge variant="danger" title={error ?? undefined}>
          Shopify error{error ? `: ${error}` : ""}
        </Badge>
      );
  }
}
