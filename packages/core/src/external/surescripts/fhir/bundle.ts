import { Bundle, Medication } from "@medplum/fhirtypes";
import { NDC_URL } from "@metriport/shared/medical";
import { buildBundle } from "../../fhir/bundle/bundle";
import { ResponseDetail } from "../schema/response";
import { IncomingData } from "../schema/shared";
import { getAllBundleEntries } from "./bundle-entry";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { hydrateFhir } from "../../fhir/hydration/hydrate-fhir";
import { crosswalkNdcToRxNorm } from "../../term-server";

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
  await hydrateFhir(bundle, console.log);

  return bundle;
}

async function dangerouslyHydrateMedications(bundle: Bundle): Promise<void> {
  if (!bundle.entry) return;

  for (const entry of bundle.entry) {
    if (!entry.resource || entry.resource.resourceType !== "Medication") continue;
    const medication = entry.resource as Medication;

    const ndcCode = medication.code?.coding?.find(coding => coding.system === NDC_URL);
    if (!ndcCode || !ndcCode.code) continue;

    const rxNormCode = await crosswalkNdcToRxNorm(ndcCode.code);
    if (!rxNormCode) continue;
    medication.code?.coding?.push(rxNormCode);
  }
}
