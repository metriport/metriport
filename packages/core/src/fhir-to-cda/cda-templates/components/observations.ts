import { Observation } from "@medplum/fhirtypes";
import { CDAObservation } from "../../cda-types/observation";
import {
  TIMESTAMP_CLEANUP_REGEX,
  buildCodeCVFromCodeableConcept,
  buildInstanceIdentifier,
  buildInstanceIdentifiersFromIdentifier,
  buildValueST,
  withoutNullFlavorObject,
} from "../commons";
import { classCodeAttribute, codeAttribute, moodCodeAttribute, valueAttribute } from "../constants";

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
            extension: "2015-08-01",
          }),
          id: buildInstanceIdentifiersFromIdentifier(observation.identifier),
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
