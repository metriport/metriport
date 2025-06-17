import { Bundle } from "@medplum/fhirtypes";
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

  return bundle;
}
