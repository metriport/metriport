import { Observation } from "@medplum/fhirtypes";
import { CDAInstanceIdentifier, CDACodeCV, Entry } from "../types";
import {
  buildInstanceIdentifiersFromIdentifier,
  buildCodeCVFromCodeableConcept,
  buildInstanceIdentifier,
  withoutNullFlavorString,
} from "../commons";
import { classCodeAttribute, moodCodeAttribute } from "../constants";

export interface CDAObservation {
  component: {
    observation: {
      [classCodeAttribute]: Entry;
      [moodCodeAttribute]: Entry;
      id?: CDAInstanceIdentifier[] | Entry;
      code: CDACodeCV | Entry;
      text?: Entry;
      statusCode?: {
        code: Entry;
      };
      effectiveTime?: {
        value: Entry;
      };
      priorityCode?: Entry;
      // TODO support other types of values like CodeableConcept, Quantity, etc.
      value?: string | undefined;
    };
  };
}

export function buildObservations(observations: Observation[]): CDAObservation[] {
  return observations.map(observation => {
    const effectiveTime = observation.effectiveDateTime?.replace(/-|:|\.\d+Z$/g, "");
    return {
      component: {
        observation: {
          [classCodeAttribute]: "OBS",
          [moodCodeAttribute]: "EVN",
          templateId: buildInstanceIdentifier({
            root: "2.16.840.1.113883.10.20.22.4.2",
            extension: "2015-08-01",
          }),
          id: buildInstanceIdentifiersFromIdentifier(observation.identifier),
          code: buildCodeCVFromCodeableConcept(observation.code),
          statusCode: {
            code: withoutNullFlavorString(observation.status),
          },
          effectiveTime: {
            value: withoutNullFlavorString(effectiveTime),
          },
          value: observation.valueString,
        },
      },
    };
  });
}
