import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ImportFlow } from "./import-flow";

export const metadata = { title: "Import creators" };

export default function ImportPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Import creators"
        description={
          <>
            Creators whose handle already exists are updated, not duplicated.{" "}
            <Link href="/creators" className="underline">
              Back to creators
            </Link>
          </>
        }
      />
      <ImportFlow />
    </div>
  );
}
