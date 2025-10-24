import { Bundle, Medication } from "@medplum/fhirtypes";
import { buildBundle } from "../../fhir/bundle/bundle";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { dangerouslyHydrateMedication } from "../../fhir/hydration/hydrate-fhir";
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
  await dangerouslyHydrateMedications(bundle);
  return bundle;
}

async function dangerouslyHydrateMedications(bundle: Bundle) {
  if (!bundle.entry) return;
  for (const entry of bundle.entry) {
    if (!entry.resource || entry.resource.resourceType !== "Medication") continue;
    const medication = entry.resource as Medication;
    await dangerouslyHydrateMedication(medication);
  }
}
