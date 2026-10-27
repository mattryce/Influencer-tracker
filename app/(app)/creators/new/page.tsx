import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { NewCreatorForm } from "../creator-forms";

export const metadata = { title: "Add creator" };

export default function NewCreatorPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Add creator"
        description={
          <>
            Adding a lot at once? <Link href="/creators/import" className="underline">Import a CSV</Link> instead.
          </>
        }
      />
      <Card>
        <CardContent className="pt-5">
          <NewCreatorForm />
        </CardContent>
      </Card>
    </div>
  );
}
