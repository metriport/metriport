import { Observation, Resource } from "@medplum/fhirtypes";
import { isObservation } from "../external/fhir/shared";
import { mentalHealthSurveyCodes, socialHistorySurveyCodes } from "./cda-templates/constants";

export function isMentalSurveyObservation(resource: Resource | undefined): resource is Observation {
  if (!isObservation(resource)) {
    return false;
  }

  return resource?.code?.coding?.[0]?.code
    ? mentalHealthSurveyCodes.includes(resource.code.coding[0].code.toLowerCase())
    : false;
}

export function isSocialHistoryObservation(
  resource: Resource | undefined
): resource is Observation {
  if (!isObservation(resource)) {
    return false;
  }

  return resource?.code?.coding?.[0]?.code
    ? socialHistorySurveyCodes.includes(resource.code.coding[0].code.toLowerCase())
    : false;
}
