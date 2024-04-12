import { Observation } from "@medplum/fhirtypes";
import {
  TIMESTAMP_CLEANUP_REGEX,
  buildCodeCVFromCodeableConcept,
  buildInstanceIdentifier,
  buildValueST,
  withoutNullFlavorObject,
} from "../commons";
import {
  classCodeAttribute,
  codeAttribute,
  extensionAttribute,
  extensionValue2015,
  moodCodeAttribute,
  placeholderOrgOid,
  rootAttribute,
  valueAttribute,
} from "../constants";
import { CDACodeCV, CDAInstanceIdentifier, CDAValueST, Entry, EntryObject } from "../types";

export interface CDAObservation {
  component: {
    observation: {
      [classCodeAttribute]: Entry;
      [moodCodeAttribute]: Entry;
      id?: CDAInstanceIdentifier[] | Entry;
      code: CDACodeCV | Entry;
      text?: Entry;
      statusCode?: EntryObject;
      effectiveTime?: {
        low?: EntryObject;
        high?: EntryObject;
      };
      priorityCode?: Entry;
      // TODO support other types of values like CodeableConcept, Quantity, etc.
      value?: CDAValueST | undefined;
    };
  };
}

export function buildObservations(observations: Observation[]): CDAObservation[] {
  return observations.map(observation => {
    const effectiveTime = observation.effectiveDateTime?.replace(TIMESTAMP_CLEANUP_REGEX, "");
    return {
      component: {
        observation: {
          [classCodeAttribute]: "OBS",
          [moodCodeAttribute]: "EVN",
          templateId: buildInstanceIdentifier({
            root: "2.16.840.1.113883.10.20.22.4.2",
            extension: extensionValue2015,
          }),
          id: {
            [rootAttribute]: placeholderOrgOid,
            [extensionAttribute]: observation.id ?? observation.identifier?.[0]?.value ?? "",
          },
          code: buildCodeCVFromCodeableConcept(observation.code),
          statusCode: withoutNullFlavorObject(observation.status, codeAttribute),
          effectiveTime: {
            low: withoutNullFlavorObject(effectiveTime, valueAttribute),
            high: withoutNullFlavorObject(effectiveTime, valueAttribute),
          },
          value: buildValueST(observation.valueString),
        },
      },
    };
  });
}
