import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { IncomingData } from "../schema/shared";
import { initializeContext } from "./shared";
import { getAllBundleEntries } from "./bundle-entry";

export async function convertIncomingDataToFhirBundle(
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  const bundle: Bundle = {
    resourceType: "Bundle",
    total: 0,
    type: "collection",
    entry: [],
  };

  const context = initializeContext(patientId);
  for (const detail of details) {
    const entries = getAllBundleEntries(context, detail);
    bundle.entry?.push(...entries);
    bundle.total = (bundle.total ?? 0) + entries.length;
  }

  return deduplicateBundleEntries(bundle);
}

function deduplicateBundleEntries(bundle: Bundle): Bundle {
  const entryMap: Record<string, BundleEntry> = {};
  for (const entry of bundle.entry ?? []) {
    if (!entry.fullUrl) continue;
    entryMap[entry.fullUrl] = entry;
  }
  const entries = Object.values(entryMap);
  return {
    ...bundle,
    total: entries.length,
    entry: entries,
  };
}
