import type { Customer } from "@/lib/types";
import { integrationConfig } from "./config";
import { joinKey, phoneKey } from "./normalize";
import type { CustomerIndex } from "./aggregate";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — apptics-pay adapter (payment onboarding).
//
// Reads merchant payment-onboarding submissions from the pay.apptics.ai export
// (CSV, ?filter=all&apiKey=…) and enriches the matching CRM customer (by email
// or phone) with a payment `onboarding` record + the form fields.
//
//   submission COMPLETED → onboarding.completedAt set → reaches "Won"/Onboarding
//   submission IN_PROGRESS → onboarding started, not yet complete
// ─────────────────────────────────────────────────────────────────────────────

type Row = Record<string, string>;

/** Minimal RFC-4180 CSV parser (handles quotes, escaped quotes, embedded commas/newlines). */
function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.length > 1);
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0];
  return nonEmpty
    .slice(1)
    .filter((r) => r[0])
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])) as Row);
}

async function fetchSubmissions(): Promise<Row[]> {
  const { exportUrl, exportApiKey } = integrationConfig.apticsPay;
  if (!exportUrl || !exportApiKey) return [];
  try {
    const url = `${exportUrl}?filter=all&apiKey=${encodeURIComponent(exportApiKey)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[apptics-pay] HTTP ${res.status} on export`);
      return [];
    }
    return parseCsv(await res.text());
  } catch (err) {
    console.error("[apptics-pay] fetch failed:", (err as Error).message);
    return [];
  }
}

/** Find the CRM customer this submission belongs to (email first, then phone). */
function matchCustomer(s: Row, index: CustomerIndex): Customer | undefined {
  const emails = [
    s.businessEmail,
    s.corporateBusinessEmail,
    s.corporateContactEmail,
    s.fulfillmentContactEmail,
  ];
  for (const e of emails) {
    if (e) {
      const hit = index.byEmail.get(joinKey(e));
      if (hit) return hit;
    }
  }
  const phones = [s.phoneNumber, s.corporateBusinessPhone, s.corporateContactPhone];
  for (const p of phones) {
    if (p) {
      const pk = phoneKey(p);
      if (pk.length >= 7) {
        const hit = index.byPhone.get(pk);
        if (hit) return hit;
      }
    }
  }
  return undefined;
}

export async function enrichWithApticsPay(index: CustomerIndex): Promise<void> {
  const submissions = await fetchSubmissions();
  let matched = 0;
  for (const s of submissions) {
    const c = matchCustomer(s, index);
    if (!c) continue;
    matched++;
    applySubmission(c, s);
  }
  if (submissions.length) {
    console.log(
      `[apptics-pay] ${matched}/${submissions.length} submissions matched to CRM leads`,
    );
  }
}

/** Patch a customer with a payment-onboarding record. */
export function applySubmission(c: Customer, s: Row): void {
  const completed = (s.status ?? "").toUpperCase() === "COMPLETED";
  const fields: Record<string, string> = {};
  if (s.llcName || s.dbaName) fields["Business"] = s.llcName || s.dbaName;
  if (s.monthlyVolume) fields["Monthly volume"] = `$${s.monthlyVolume}`;
  if (s.currentProcessor) fields["Current processor"] = s.currentProcessor;
  if (s.businessCategory) fields["Category"] = s.businessCategory;
  if (s.avgTransactionAmount) fields["Avg transaction"] = `$${s.avgTransactionAmount}`;

  c.onboarding = {
    form: "payment",
    completedAt: completed ? (s.completedAt || s.updatedAt || undefined) : undefined,
    fields,
    paymentCustomerId: s.id,
  };
}
