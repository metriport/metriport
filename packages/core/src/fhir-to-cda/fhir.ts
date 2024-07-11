import { Observation, Resource } from "@medplum/fhirtypes";
import { isObservation } from "../external/fhir/shared";
import { mentalHealthSurveyCodes } from "./cda-templates/constants";

export function isMentalSurveyObservation(resource: Resource | undefined): resource is Observation {
  if (!isObservation(resource)) {
    return false;
  }

  if (resource.code?.coding) {
    for (const coding of resource.code.coding) {
      const code = coding?.code;
      if (code && mentalHealthSurveyCodes.includes(code.toLowerCase())) return true;
    }
  }

  return (
    resource.category?.some(category =>
      category?.coding?.some(coding => coding.code === "survey")
    ) ?? false
  );
}

export function isSocialHistoryObservation(
  resource: Resource | undefined
): resource is Observation {
  if (!resource || !isObservation(resource)) {
    return false;
  }

  return (
    resource.category?.some(category =>
      category?.coding?.some(coding => coding.code === "social-history")
    ) ?? false
  );
}

export function isVitalSignsObservation(resource: Resource | undefined): resource is Observation {
  if (!isObservation(resource)) {
    return false;
  }

  return (
    resource?.category?.some(category =>
      category?.coding?.some(coding => coding.code === "vital-signs")
    ) ?? false
  );
}
