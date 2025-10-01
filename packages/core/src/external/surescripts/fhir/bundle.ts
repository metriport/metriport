import { Bundle } from "@medplum/fhirtypes";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { buildBundle } from "../../fhir/bundle/bundle";
import { hydrateFhir } from "../../fhir/hydration/hydrate-fhir";
import { ResponseDetail } from "../schema/response";
import { IncomingData } from "../schema/shared";
import { getAllBundleEntries } from "./bundle-entry";

export async function convertIncomingDataToFhirBundle(
  cxId: string,
  patientId: string,
  details: IncomingData<ResponseDetail>[]
): Promise<Bundle> {
  const bundle = buildBundle({ type: "collection", entries: [] });
  for (const detail of details) {
    const entries = getAllBundleEntries(detail);
    bundle.entry?.push(...entries);
  }
  dangerouslyDeduplicateFhir(bundle, cxId, patientId);
  await hydrateFhir(bundle, console.log);

  return bundle;
}
