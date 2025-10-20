import { Encounter, Location } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared";
import { getValidCodings } from "../../codeable-concept";
import { buildReferenceFromStringRelative } from "../../bundle/bundle";

export function filterInvalidEncounters(
  encounters: Encounter[],
  locations: Location[]
): Encounter[] {
  return encounters.flatMap(encounter => {
    const hasReason = hasEncounterReason(encounter);
    const hasLocation = hasEncounterLocation(encounter, locations);
    const hasType = hasEncounterType(encounter);
    if (!hasReason && !hasLocation && !hasType) return [];

    return encounter;
  });
}

function hasEncounterReason(encounter: Encounter): boolean {
  const reasonSet = new Set<string>();

  for (const reason of encounter.reasonCode ?? []) {
    const text = reason.text;

    if (text) {
      reasonSet.add(normalizeDisplay(text));
    }

    const codings = getValidCodings(reason.coding ?? []);

    codings.forEach(c => {
      if (c.display) reasonSet.add(normalizeDisplay(c.display));
    });
  }

  return reasonSet.size > 0;
}

function hasEncounterLocation(encounter: Encounter, locations: Location[]): boolean {
  const locationNames = encounter.location?.flatMap(locationRef => {
    const refString = locationRef.location?.reference;
    if (!refString) return [];

    const refObj = buildReferenceFromStringRelative(refString);
    const refId = refObj?.id;
    if (!refId) return [];

    return locations.find(l => l.id === refId)?.name ?? [];
  });

  return locationNames && locationNames.length > 0 ? true : false;
}

function hasEncounterType(encounter: Encounter): boolean {
  const classDisplay = encounter.class?.display;
  const isUsefulClassDisplay = isDisplayUseful(classDisplay);

  if (classDisplay && isUsefulClassDisplay) {
    return true;
  } else if (encounter.class?.extension) {
    const extension = encounter.class?.extension?.find(coding => {
      return coding.valueCoding?.code === encounter.class?.code;
    });

    const extDisplay = extension?.valueCoding?.display;
    return extDisplay && isDisplayUseful(extDisplay) ? true : false;
  } else if (encounter.type) {
    const allTypeStringSet = new Set<string>();

    for (const type of encounter.type) {
      if (type.text && isDisplayUseful(type.text)) {
        allTypeStringSet.add(normalizeDisplay(type.text));
      }
      type.coding?.forEach(c => {
        if (c.display && isDisplayUseful(c.display))
          allTypeStringSet.add(normalizeDisplay(c.display));
      });
    }
    return allTypeStringSet.size > 0;
  }

  return false;
}

/**
 * TODO Check if we can reuse isUsefulDisplay()
 */
function isDisplayUseful(display: string | undefined) {
  return display != undefined && display.trim() !== "unknown";
}

function normalizeDisplay(str: string): string {
  return toTitleCase(str.trim());
}
