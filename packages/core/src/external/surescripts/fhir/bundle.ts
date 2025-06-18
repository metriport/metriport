import { Bundle } from "@medplum/fhirtypes";
import { buildBundle } from "../../fhir/bundle/bundle";
import { ResponseDetail } from "../schema/response";
import { IncomingData } from "../schema/shared";
import { initializeContext } from "./shared";
import { getAllBundleEntries } from "./bundle-entry";

export async function convertIncomingDataToFhirBundle(
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  const bundle = buildBundle({ type: "collection", entries: [] });
  const context = initializeContext(patientId);
  for (const detail of details) {
    const entries = getAllBundleEntries(context, detail);
    bundle.entry?.push(...entries);
  }
  return bundle;
}
