import { toArray } from "@metriport/shared";
import {
  ConcernActEntry,
  ObservationEntry,
  ObservationMediaEntry,
  ObservationOrganizer,
  ObservationOrganizerEntry,
} from "../../fhir-to-cda/cda-types/shared-types";

const observationOrganizerTemplateId = "2.16.840.1.113883.10.20.22.4.1";

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isConcernActEntry(entry: any): entry is ConcernActEntry {
  return entry.act !== undefined;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isObservationOrganizer(entry: any): entry is ObservationOrganizerEntry {
  return toArray(entry?.organizer?.templateId).some(
    template => template._root == observationOrganizerTemplateId
  );
}

function isMediaObservation(
  component: ObservationEntry | ObservationMediaEntry
): component is ObservationMediaEntry {
  return "observationMedia" in component;
}

export function groupObservations(organizer: ObservationOrganizer): {
  mediaObservations: ObservationMediaEntry[];
  nonMediaObservations: ObservationEntry[];
} {
  const mediaObs: ObservationMediaEntry[] = [];
  const nonMediaObs: ObservationEntry[] = [];
  toArray(organizer.component).forEach(comp => {
    if (isMediaObservation(comp)) mediaObs.push(comp);
    else nonMediaObs.push(comp);
  });

  return {
    mediaObservations: mediaObs,
    nonMediaObservations: nonMediaObs,
  };
}
