import { Bundle, Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import _, { cloneDeep } from "lodash";
import { dangerouslyDeduplicateFhir } from "../../../fhir-deduplication/deduplicate-fhir";
import { groupSameEncountersDatetimeOnly } from "../../../fhir-deduplication/resources/encounter";
import { normalizeFhir } from "../normalization/normalize-fhir";
import { isEncounter } from "../shared";
import { buildBundle, buildBundleEntry, RequiredBundleType } from "./bundle";

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

/**
 * Additional deduplication logic for ADT encounters to more aggresively deduplicate than
 * our core deduplication logic. This is only used for ADT encounters.
 *
 * ⚠️ NOTE: This function relies on the assumption that all resource ids in the bundle
 * are stable, because we do not use the refReplacementMap from `groupSameEncountersDatetimeOnly`.
 * If resource ids are not stable, and there are references pointing to an encounter, the
 * references will not be updated and will be left broken.
 *
 * TODO: Fix this ^, ticket at ENG-876
 */
export function dedupeAdtEncounters(existing: Bundle<Resource>): Bundle<Resource> {
  const [encounters, nonEncounters] = _(existing.entry)
    .map("resource")
    .partition(isEncounter)
    .value();

  const { encountersMap: dedupedEncountersMap } = groupSameEncountersDatetimeOnly(encounters);

  const encounterBundleEntries = [...dedupedEncountersMap.values()].map(buildBundleEntry);
  const nonEncounterBundleEntries = _(nonEncounters).compact().map(buildBundleEntry).value();

  //const newBundle = FhirBundleSdk.createSync(existing).toObject();
  existing.entry = [...encounterBundleEntries, ...nonEncounterBundleEntries];

  return existing;
}
