import { buildBoardingHouseWorkbookBytes } from "./buildBoardingHouseWorkbook";
import {
  filterNewPayments,
  knownIds,
  mapParsedBillingPatches,
  mapParsedPayments,
  mapParsedRosterPatches,
  preserveLiveLedgerForNewPayments,
} from "./mapToTracker";
import { parseBoardingHouseWorkbook } from "./parseBoardingHouse";
import type { SpreadsheetRepository, SpreadsheetSyncResult } from "./types";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
}

export function spreadsheetStoragePath(landlordId: string, filename: string): string {
  return `${landlordId}/${Date.now()}-${sanitizeFilename(filename)}`;
}

export async function parseAndSyncUpload(
  repo: SpreadsheetRepository,
  input: { filename: string; bytes: Uint8Array; landlordId: string },
): Promise<SpreadsheetSyncResult> {
  const parsed = await parseBoardingHouseWorkbook(input.bytes);
  const [beds, billing, payments] = await Promise.all([
    repo.listBeds(),
    repo.listBilling(),
    repo.listPayments(),
  ]);
  const bedIds = knownIds(beds);
  const billingIds = new Set(billing.map((row) => row.billing_id));

  const mappedPayments = mapParsedPayments(parsed.payments, bedIds);
  const freshPayments = filterNewPayments(mappedPayments, payments);
  const billingPatches = preserveLiveLedgerForNewPayments(
    mapParsedBillingPatches(parsed.billing, billingIds),
    billing,
    freshPayments,
  );
  const rosterPatches = mapParsedRosterPatches(parsed.roster, bedIds);

  // Billing first so a new verified payment applies on top of the live ledger.
  // Inserting payments first let apply_verified_payment credit the bed, then
  // the spreadsheet's older total_balance wrote that credit away.
  const billingUpdated = await repo.updateBilling(billingPatches);
  const rosterUpdated = await repo.updateBeds(rosterPatches);
  const paymentsUpserted = await repo.upsertPayments(freshPayments);

  const storagePath = spreadsheetStoragePath(input.landlordId, input.filename);
  await repo.uploadFile(storagePath, input.bytes, XLSX_MIME);
  await repo.logUpload({
    storagePath,
    filename: input.filename,
    paymentsUpserted,
    paymentsSkipped: mappedPayments.length - freshPayments.length + (parsed.payments.length - mappedPayments.length),
    rosterUpdated,
    billingUpdated,
  });

  return {
    status: "success",
    storagePath,
    recordsSynced: {
      payments: paymentsUpserted,
      paymentsSkipped:
        mappedPayments.length - freshPayments.length + (parsed.payments.length - mappedPayments.length),
      roster: rosterUpdated,
      billing: billingUpdated,
    },
  };
}

export async function exportLatestSpreadsheet(repo: SpreadsheetRepository): Promise<{
  filename: string;
  bytes: Uint8Array;
}> {
  const [beds, billingRecords, payments] = await Promise.all([
    repo.listBeds(),
    repo.listBilling(),
    repo.listPayments(),
  ]);
  const bytes = await buildBoardingHouseWorkbookBytes({ beds, billingRecords, payments });
  return { filename: "Boarding_House_Latest.xlsx", bytes };
}
