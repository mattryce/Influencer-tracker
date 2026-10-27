"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeBrandMember } from "../actions";

export function RemoveMemberButton({ brandId, userId, name }: { brandId: string; userId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (confirm(`Remove ${name}'s access to this brand?`)) start(() => removeBrandMember(brandId, userId));
      }}
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}
