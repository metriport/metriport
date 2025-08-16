import { Bundle, Resource } from "@medplum/fhirtypes";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { MetriportError } from "@metriport/shared";
import { cloneDeep } from "lodash";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { groupSameEncountersDateOnly } from "../../../fhir-deduplication/resources/encounter";
import { normalizeFhir } from "../normalization/normalize-fhir";
import { buildBundle, RequiredBundleType } from "./bundle";

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
    throw new MetriportError(`Entry field on both bundles must exist`, undefined, {
      existingEntry: !!existing.entry,
      currentEntry: !!current.entry,
    });
  }

  const newBundle = buildBundle({
    type: bundleType,
    entries: cloneDeep([...existing.entry, ...current.entry]),
  });
  dangerouslyDeduplicateFhir(newBundle, cxId, patientId);
  return normalizeFhir(newBundle);
}

export function dedupeAdtEncounters(existing: Bundle<Resource>): Bundle<Resource> {
  const originalBundle = FhirBundleSdk.createSync(existing);
  const encounters = originalBundle.getEncounters();

  const { encountersMap: dedupedEncountersMap } = groupSameEncountersDateOnly(encounters);

  const nonEncounterResources = originalBundle.entry.filter(
    entry => entry.resource?.resourceType !== "Encounter"
  );

  const newBundle = originalBundle.toObject();
  newBundle.entry = [...nonEncounterResources, ...dedupedEncountersMap.values()];

  return newBundle;
}
