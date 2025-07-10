import { Bundle, Medication } from "@medplum/fhirtypes";
import { buildBundle } from "../../fhir/bundle/bundle";
import { ResponseDetail } from "../schema/response";
import { IncomingData } from "../schema/shared";
import { getAllBundleEntries } from "./bundle-entry";

import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { hydrateFhir } from "../../fhir/hydration/hydrate-fhir";
import { crosswalkNdcToRxNorm } from "../../term-server";
import { NDC_URL } from "../../../util/constants";
import { RELATED_ARTIFACT_URL } from "./constants";

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
  dangerouslyRemoveDerivedFromExtensions(bundle);
  await dangerouslyHydrateMedications(bundle);
  await hydrateFhir(bundle, console.log);

  return bundle;
}

function dangerouslyRemoveDerivedFromExtensions(bundle: Bundle): void {
  if (!bundle.entry) return;
  for (const entry of bundle.entry) {
    if (!entry.resource) continue;
    if ("extension" in entry.resource) {
      entry.resource.extension = entry.resource.extension.filter(extension => {
        if (
          extension.url == RELATED_ARTIFACT_URL &&
          extension.valueRelatedArtifact?.type === "derived-from"
        ) {
          return false;
        }
        return true;
      });
    }
  }
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
