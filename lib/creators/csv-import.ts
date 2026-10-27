import Papa from "papaparse";
import { PLATFORMS, type Platform } from "@/lib/types";
import { normalizeHandle } from "./handles";

/** Columns we understand. Header matching is case-insensitive and ignores spaces/underscores. */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "creatorname", "fullname", "creator"],
  email: ["email", "emailaddress"],
  phone: ["phone", "phonenumber", "mobile", "cell"],
  instagram: ["instagram", "ig", "instagramhandle", "ighandle", "instagramurl"],
  tiktok: ["tiktok", "tt", "tiktokhandle", "tiktokurl"],
  youtube: ["youtube", "yt", "youtubehandle", "youtubeurl", "youtubechannel"],
  tags: ["tags", "tag", "categories"],
  notes: ["notes", "note", "comments"],
};

export const CSV_TEMPLATE_HEADER = "name,email,phone,instagram,tiktok,youtube,tags,notes";

export interface CsvRow {
  rowNumber: number; // 1-based line number in the file, counting the header as line 1
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  notes: string | null;
  handles: Partial<Record<Platform, string>>; // raw, un-normalized
}

export interface ParsedCsv {
  rows: CsvRow[];
  unknownColumns: string[];
  missingName: boolean;
}

const canon = (h: string) => h.toLowerCase().replace(/[\s_\-.]/g, "");

export function parseCreatorCsv(text: string): ParsedCsv {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const mapping = new Map<string, string>(); // original header -> field
  const unknownColumns: string[] = [];
  for (const h of headers) {
    const field = Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(canon(h)))?.[0];
    if (field && ![...mapping.values()].includes(field)) mapping.set(h, field);
    else unknownColumns.push(h);
  }

  const rows: CsvRow[] = parsed.data.map((raw, i) => {
    const get = (field: string) => {
      for (const [h, f] of mapping) if (f === field) return (raw[h] ?? "").trim();
      return "";
    };
    const handles: Partial<Record<Platform, string>> = {};
    for (const p of PLATFORMS) {
      const v = get(p);
      if (v) handles[p] = v;
    }
    const tags = get("tags")
      .split(/[,;|]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    return {
      rowNumber: i + 2,
      name: get("name"),
      email: get("email").toLowerCase() || null,
      phone: get("phone") || null,
      tags: Array.from(new Set(tags)),
      notes: get("notes") || null,
      handles,
    };
  });

  return { rows, unknownColumns, missingName: ![...mapping.values()].includes("name") };
}

export interface ExistingAccount {
  creator_id: string;
  creator_name: string;
  platform: Platform;
  handle: string;
}

export interface PlannedAccount {
  platform: Platform;
  handle: string;
  profile_url: string;
}

export interface PlannedCreate {
  rowNumbers: number[];
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  accounts: PlannedAccount[];
}

export interface PlannedMerge {
  rowNumbers: number[];
  creator_id: string;
  creator_name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  accounts: PlannedAccount[]; // only accounts the creator doesn't already have
}

export interface RowIssue {
  rowNumber: number;
  message: string;
}

export interface ImportPlan {
  creates: PlannedCreate[];
  merges: PlannedMerge[];
  errors: RowIssue[]; // row skipped entirely
  warnings: RowIssue[]; // row imported, but something was dropped
}

const key = (p: Platform, h: string) => `${p}:${h}`;

/**
 * Decide what importing a CSV will do, without touching the database.
 *  - Rows whose handle matches an existing creator account are merged into that creator.
 *  - Rows in the same file that share a handle are combined into one creator.
 *  - A row whose handles point at two *different* existing creators is rejected (ambiguous).
 */
export function planCreatorImport(rows: CsvRow[], existing: ExistingAccount[]): ImportPlan {
  const existingByKey = new Map(existing.map((a) => [key(a.platform, a.handle), a]));
  const plan: ImportPlan = { creates: [], merges: [], errors: [], warnings: [] };
  const createByKey = new Map<string, PlannedCreate>();
  const mergeByCreator = new Map<string, PlannedMerge>();
  const claimedKeys = new Set<string>(); // handles already assigned to some planned creator/merge

  for (const row of rows) {
    if (!row.name) {
      plan.errors.push({ rowNumber: row.rowNumber, message: "Missing name" });
      continue;
    }

    const accounts: PlannedAccount[] = [];
    for (const p of PLATFORMS) {
      const raw = row.handles[p];
      if (!raw) continue;
      const r = normalizeHandle(p, raw);
      if (r.ok) accounts.push({ platform: p, handle: r.handle, profile_url: r.profileUrl });
      else plan.warnings.push({ rowNumber: row.rowNumber, message: `${r.error} — skipped this handle` });
    }

    const existingMatches = new Map<string, ExistingAccount>();
    for (const a of accounts) {
      const hit = existingByKey.get(key(a.platform, a.handle));
      if (hit) existingMatches.set(hit.creator_id, hit);
    }
    if (existingMatches.size > 1) {
      const names = [...existingMatches.values()].map((m) => m.creator_name).join(" and ");
      plan.errors.push({
        rowNumber: row.rowNumber,
        message: `Handles belong to different existing creators (${names}). Fix the row or merge them first.`,
      });
      continue;
    }

    if (existingMatches.size === 1) {
      const match = [...existingMatches.values()][0];
      let merge = mergeByCreator.get(match.creator_id);
      if (!merge) {
        merge = {
          rowNumbers: [],
          creator_id: match.creator_id,
          creator_name: match.creator_name,
          email: null,
          phone: null,
          tags: [],
          accounts: [],
        };
        mergeByCreator.set(match.creator_id, merge);
        plan.merges.push(merge);
      }
      merge.rowNumbers.push(row.rowNumber);
      merge.email ??= row.email;
      merge.phone ??= row.phone;
      merge.tags = Array.from(new Set([...merge.tags, ...row.tags]));
      for (const a of accounts) {
        const k = key(a.platform, a.handle);
        if (existingByKey.has(k) || claimedKeys.has(k)) continue;
        // A different existing account on the same platform means the row disagrees with what we have.
        if (existing.some((e) => e.creator_id === match.creator_id && e.platform === a.platform)) {
          plan.warnings.push({
            rowNumber: row.rowNumber,
            message: `${match.creator_name} already has a ${a.platform} account; added @${a.handle} as an additional one`,
          });
        }
        merge.accounts.push(a);
        claimedKeys.add(k);
      }
      continue;
    }

    // No existing match — combine with an earlier row in this file that shares a handle.
    const sameFile = accounts.map((a) => createByKey.get(key(a.platform, a.handle))).find(Boolean);
    if (sameFile) {
      sameFile.rowNumbers.push(row.rowNumber);
      sameFile.email ??= row.email;
      sameFile.phone ??= row.phone;
      sameFile.notes ??= row.notes;
      sameFile.tags = Array.from(new Set([...sameFile.tags, ...row.tags]));
      for (const a of accounts) {
        const k = key(a.platform, a.handle);
        if (claimedKeys.has(k)) continue;
        sameFile.accounts.push(a);
        createByKey.set(k, sameFile);
        claimedKeys.add(k);
      }
      plan.warnings.push({
        rowNumber: row.rowNumber,
        message: `Same creator as row ${sameFile.rowNumbers[0]} (shared handle) — combined`,
      });
      continue;
    }

    if (accounts.length === 0) {
      plan.warnings.push({
        rowNumber: row.rowNumber,
        message: "No valid social handles — creator added without accounts (can't be deduplicated later)",
      });
    }
    const create: PlannedCreate = {
      rowNumbers: [row.rowNumber],
      name: row.name,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      tags: row.tags,
      accounts: [],
    };
    for (const a of accounts) {
      const k = key(a.platform, a.handle);
      create.accounts.push(a);
      createByKey.set(k, create);
      claimedKeys.add(k);
    }
    plan.creates.push(create);
  }

  return plan;
}
