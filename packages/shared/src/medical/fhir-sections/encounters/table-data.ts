import { Encounter, Location } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { getResourcesFromBundle, getValidCode, MappedConsolidatedResources, SectionKey } from "..";

export type EncounterRowData = {
  id: string;
  reasons: string;
  location: string;
  type: string;
  startDate: string;
  endDate: string;
};

export function encounterTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const encounters = getResourcesFromBundle<Encounter>(bundle, "Encounter");
  const locations = getResourcesFromBundle<Location>(bundle, "Location");
  return {
    key: "encounters" as SectionKey,
    rowData: getEncounterRowData({ encounters, locations }),
  };
}

function getEncounterRowData({
  encounters,
  locations,
}: {
  encounters: Encounter[];
  locations: Location[];
}): EncounterRowData[] {
  return encounters.flatMap(encounter => mapEncounterRow(encounter, locations) ?? []);
}

function mapEncounterRow(
  encounter: Encounter,
  locations: Location[]
): EncounterRowData | undefined {
  const reasons = getEncountersDisplay(encounter);
  const location = getEncounterLocation(encounter, locations);
  const type = renderClassDisplay(encounter);

  if (!reasons && !location && !type) return undefined;

  return {
    id: encounter.id ?? "-",
    reasons: reasons ?? "-",
    location: location ?? "-",
    type: type ?? "-",
    startDate: encounter.period?.start ? dayjs(encounter.period.start).format(ISO_DATE) : "-",
    endDate: encounter.period?.end ? dayjs(encounter.period.end).format(ISO_DATE) : "-",
  };
}

function getEncountersDisplay(encounter: Encounter): string | undefined {
  const reasonSet = new Set<string>();

  for (const reason of encounter.reasonCode ?? []) {
    const text = reason.text;

    if (text) {
      reasonSet.add(normalizeDisplay(text));
    }

    const codings = getValidCode(reason.coding);

    codings.forEach(c => {
      if (c.display) reasonSet.add(normalizeDisplay(c.display));
    });
  }

  const reasons = Array.from(reasonSet);
  return reasons.length > 0 ? reasons.join(", ") : undefined;
}

function getEncounterLocation(encounter: Encounter, locations: Location[]): string | undefined {
  const locationId = encounter.location?.[0]?.location?.reference?.split("/")?.[1];
  const location = locations.find(l => l.id === locationId);
  return location?.name;
}

function renderClassDisplay(encounter: Encounter): string | undefined {
  const isUsefulDisplay = isDisplayUseful(encounter.class?.display);

  if (encounter.class?.display && isUsefulDisplay) {
    return normalizeDisplay(encounter.class?.display);
  } else if (encounter.class?.extension) {
    const extension = encounter.class?.extension?.find(coding => {
      return coding.valueCoding?.code === encounter.class?.code;
    });
    return extension?.valueCoding?.display
      ? normalizeDisplay(extension.valueCoding.display)
      : undefined;
  } else if (encounter.type) {
    const allTypeStringSet = new Set<string>();

    for (const type of encounter.type) {
      if (type.text && isDisplayUseful(type.text)) {
        allTypeStringSet.add(normalizeDisplay(type.text));
      }
      type.coding?.forEach(c => {
        if (c.display) allTypeStringSet.add(c.display);
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
