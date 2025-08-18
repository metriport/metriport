import { Bundle, Resource } from "@medplum/fhirtypes";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { MetriportError } from "@metriport/shared";
import { cloneDeep } from "lodash";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { groupSameEncountersDateOnly } from "../../../fhir-deduplication/resources/encounter";
import { normalizeFhir } from "../normalization/normalize-fhir";
import { buildBundle, buildBundleEntry, RequiredBundleType } from "./bundle";
import _ from "lodash";
import { isEncounter } from "../shared";

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
  const [encounters, nonEncounters] = _(existing.entry)
    .map("resource")
    .partition(isEncounter)
    .value();

  const { encountersMap: dedupedEncountersMap } = groupSameEncountersDateOnly(encounters);

  const encounterBundleEntries = [...dedupedEncountersMap.values()].map(buildBundleEntry);
  const nonEncounterBundleEntries = _(nonEncounters).compact().map(buildBundleEntry).value();

  const newBundle = FhirBundleSdk.createSync(existing).toObject();
  newBundle.entry = [...encounterBundleEntries, ...nonEncounterBundleEntries];

  return newBundle;
}
