"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm, SubmitButton } from "@/components/app/form-bits";
import { CSV_TEMPLATE_HEADER } from "@/lib/creators/csv-import";
import { commitImport, previewImport, type ImportPreview } from "../actions";

const TEMPLATE = `${CSV_TEMPLATE_HEADER}\nJane Example,jane@example.com,555-0100,@janeexample,@janeexample,https://youtube.com/@janeexample,"diesel, trucks",Met at SEMA\n`;

export function ImportFlow() {
  const [preview, previewAction, previewActionPending] = useActionState(previewImport, {} as ImportPreview);
  const [done, commitAction, commitActionPending] = useActionState(commitImport, {} as ImportPreview);

  if (done.result) {
    const r = done.result;
    return (
      <div className="space-y-4">
        <Alert variant="success">
          Imported. {r.created} new creator{r.created === 1 ? "" : "s"}, {r.merged} existing creator{r.merged === 1 ? "" : "s"} updated,{" "}
          {r.accounts_added} social account{r.accounts_added === 1 ? "" : "s"} added.
        </Alert>
        {r.skipped_accounts.length > 0 && (
          <Alert variant="warning">
            {r.skipped_accounts.length} handle(s) were added by someone else while you were importing and were skipped:{" "}
            {r.skipped_accounts.map((s) => `${s.platform} @${s.handle}`).join(", ")}
          </Alert>
        )}
        <Link href="/creators" className="text-sm underline">
          Go to creators
        </Link>
      </div>
    );
  }

  const plan = preview.plan;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose a CSV file</CardTitle>
          <CardDescription>
            Columns: name (required), email, phone, instagram, tiktok, youtube, tags, notes. Handles can be @handles or profile
            links.{" "}
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="creators-template.csv" className="underline">
              Download template
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={previewAction} pending={previewActionPending} className="flex flex-wrap items-center gap-3">
            <Input type="file" name="file" accept=".csv,text/csv" required className="max-w-sm" />
            <SubmitButton variant="outline" pendingText="Checking…">
              Preview import
            </SubmitButton>
          </ActionForm>
          {preview.error && <Alert variant="destructive" className="mt-4">{preview.error}</Alert>}
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Check what will happen{preview.fileName ? ` — ${preview.fileName}` : ""}</CardTitle>
            <CardDescription>Nothing has been saved yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="success">{plan.creates.length} new creators</Badge>
              <Badge variant="secondary">{plan.merges.length} matched to existing creator{plan.merges.length === 1 ? "" : "s"}</Badge>
              <Badge variant={plan.errors.length ? "danger" : "muted"}>{plan.errors.length} row{plan.errors.length === 1 ? "" : "s"} skipped</Badge>
              <Badge variant={plan.warnings.length ? "warning" : "muted"}>{plan.warnings.length} warning{plan.warnings.length === 1 ? "" : "s"}</Badge>
            </div>
            {preview.unknownColumns && preview.unknownColumns.length > 0 && (
              <Alert variant="warning">These columns aren&apos;t recognised and will be ignored: {preview.unknownColumns.join(", ")}</Alert>
            )}

            {(plan.errors.length > 0 || plan.warnings.length > 0) && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Row</TableHead>
                    <TableHead className="w-24" />
                    <TableHead>Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...plan.errors.map((e) => ({ ...e, kind: "Skipped" })), ...plan.warnings.map((w) => ({ ...w, kind: "Warning" }))]
                    .sort((a, b) => a.rowNumber - b.rowNumber)
                    .map((i, n) => (
                      <TableRow key={n}>
                        <TableCell className="tabular-nums">{i.rowNumber}</TableCell>
                        <TableCell>
                          <Badge variant={i.kind === "Skipped" ? "danger" : "warning"}>{i.kind}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{i.message}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}

            {plan.merges.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Matched to existing creators (no duplicate will be created)</h3>
                <ul className="list-inside list-disc text-sm">
                  {plan.merges.map((m) => (
                    <li key={m.creator_id}>
                      Row {m.rowNumbers.join(", ")} → <span className="font-medium">{m.creator_name}</span>
                      {m.accounts.length > 0 && <> (adds {m.accounts.map((a) => `${a.platform} @${a.handle}`).join(", ")})</>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ActionForm action={commitAction} pending={commitActionPending} className="flex items-center gap-3">
              <input type="hidden" name="csv" value={preview.csv ?? ""} />
              <SubmitButton pendingText="Importing…" disabled={plan.creates.length === 0 && plan.merges.length === 0}>
                Import {plan.creates.length + plan.merges.length} creators
              </SubmitButton>
              {done.error && <span className="text-sm text-red-700">{done.error}</span>}
            </ActionForm>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
