"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="max-w-xl space-y-4">
      <Alert variant="destructive">
        <p className="font-medium">This page couldn&apos;t load.</p>
        <p className="mt-1">{error.message}</p>
        {error.digest && <p className="mt-1 text-xs opacity-70">Reference: {error.digest}</p>}
      </Alert>
      <Button variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
