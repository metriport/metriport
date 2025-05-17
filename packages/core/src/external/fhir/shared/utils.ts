import { Bundle, Resource } from "@medplum/fhirtypes";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { normalizeFhir } from "../normalization/normalize-fhir";
import { buildCollectionBundle } from "./bundle";

export const mergeBundles = ({
  cxId,
  patientId,
  existing,
  current,
}: {
  cxId: string;
  patientId: string;
  existing: Bundle<Resource>;
  current: Bundle<Resource>;
}) => {
  if (!existing.entry || !current.entry) {
    throw new Error(
      `Entry field on bundles must exist: existing: ${!!existing.entry} current: ${!!current.entry}`
    );
  }

  const newBundle = buildCollectionBundle([...existing.entry, ...current.entry]);
  dangerouslyDeduplicateFhir(newBundle, cxId, patientId);
  return normalizeFhir(newBundle);
};
