import { Observation } from "@medplum/fhirtypes";
import { CDAObservation } from "../../cda-types/observation";
import {
  TIMESTAMP_CLEANUP_REGEX,
  buildCodeCvFromCodeableConcept,
  buildInstanceIdentifier,
  buildInstanceIdentifiersFromIdentifier,
  buildValueST,
  withoutNullFlavorObject,
} from "../commons";
import { _codeAttribute, _valueAttribute } from "../constants";

export function buildObservations(observations: Observation[]): CDAObservation[] {
  return observations.map(observation => {
    const effectiveTime = observation.effectiveDateTime?.replace(TIMESTAMP_CLEANUP_REGEX, "");
    return {
      component: {
        observation: {
          _classCodeAttribute: "OBS",
          _moodCodeAttribute: "EVN",
          templateId: buildInstanceIdentifier({
            root: "2.16.840.1.113883.10.20.22.4.2",
            extension: "2015-08-01",
          }),
          id: buildInstanceIdentifiersFromIdentifier(observation.identifier),
          code: buildCodeCvFromCodeableConcept(observation.code),
          statusCode: withoutNullFlavorObject(observation.status, _codeAttribute),
          effectiveTime: {
            low: withoutNullFlavorObject(effectiveTime, _valueAttribute),
            high: withoutNullFlavorObject(effectiveTime, _valueAttribute),
          },
          value: buildValueST(observation.valueString),
        },
      },
    };
  });
}
