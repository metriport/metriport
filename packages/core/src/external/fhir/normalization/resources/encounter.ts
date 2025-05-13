import { Encounter, Location } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared";
import { getValidCodings } from "../../codeable-concept";
import { buildReferenceFromStringRelative } from "../../shared/bundle";

export function normalizeEncounters(encounters: Encounter[], locations: Location[]): Encounter[] {
  return encounters.flatMap(encounter => {
    const reasons = getEncounterReason(encounter);
    const location = getEncounterLocation(encounter, locations);
    const type = getEncounterClassText(encounter);
    if (!reasons && !location && !type) return [];

    return encounter;
  });
}

function getEncounterReason(encounter: Encounter): string | undefined {
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

  const reasons = Array.from(reasonSet);
  return reasons.length > 0 ? reasons.join(", ") : undefined;
}

function getEncounterLocation(encounter: Encounter, locations: Location[]): string | undefined {
  const locationNames = encounter.location?.flatMap(locationRef => {
    const refString = locationRef.location?.reference;
    if (!refString) return [];

    const refObj = buildReferenceFromStringRelative(refString);
    const refId = refObj?.id;
    if (!refId) return [];

    return locations.find(l => l.id === refId)?.name ?? [];
  });

  return locationNames?.join(", ");
}

function getEncounterClassText(encounter: Encounter): string | undefined {
  const classDisplay = encounter.class?.display;
  const isUsefulClassDisplay = isDisplayUseful(classDisplay);

  if (classDisplay && isUsefulClassDisplay) {
    return normalizeDisplay(classDisplay);
  } else if (encounter.class?.extension) {
    const extension = encounter.class?.extension?.find(coding => {
      return coding.valueCoding?.code === encounter.class?.code;
    });

    const extDisplay = extension?.valueCoding?.display;
    return extDisplay && isDisplayUseful(extDisplay) ? normalizeDisplay(extDisplay) : undefined;
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
    return Array.from(allTypeStringSet).join(", ");
  }

  return undefined;
}

function isDisplayUseful(display: string | undefined) {
  return display !== undefined && display !== "unknown";
}

function normalizeDisplay(str: string): string {
  return toTitleCase(str.trim());
}
