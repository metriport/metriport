import { Bundle, Resource } from "@medplum/fhirtypes";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { normalizeFhir } from "../normalization/normalize-fhir";
import { buildBundle, RequiredBundleType } from "./bundle";
import { MetriportError } from "@metriport/shared";
import { cloneDeep } from "lodash";

export function mergeBundles({
  cxId,
  patientId,
  existing,
  current,
  bundleType,
}: {
  cxId: string;
  patientId: string;
  existing: Bundle<Resource>;
  current: Bundle<Resource>;
  bundleType: RequiredBundleType;
}): Bundle<Resource> {
  if (!existing.entry || !current.entry) {
    throw new MetriportError(
      `Entry field on bundles must exist: existing: ${!!existing.entry} current: ${!!current.entry}`,
      undefined,
      {
        existingEntry: !!existing.entry,
        currentEntry: !!current.entry,
      }
    );
  }

  const newBundle = buildBundle({
    type: bundleType,
    entries: cloneDeep([...existing.entry, ...current.entry]),
  });
  dangerouslyDeduplicateFhir(newBundle, cxId, patientId);
  return normalizeFhir(newBundle);
}
