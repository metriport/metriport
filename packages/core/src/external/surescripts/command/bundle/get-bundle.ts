import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { buildCollectionBundle } from "../../../fhir/bundle/bundle";

/**
 * TODO ENG-476 Implement this
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function getPharmacyBundle({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<Bundle> {
  return buildCollectionBundle([]);
}

export async function getPharmacyResources({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<BundleEntry[]> {
  const bundle = await getPharmacyBundle({ cxId, patientId });
  return bundle.entry ?? [];
}
