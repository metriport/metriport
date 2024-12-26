import { Bundle, Resource } from "@medplum/fhirtypes";
import {
  addExtensionToConversion,
  addMissingRequests,
  removePatientFromConversion,
  replaceIdsForResourcesWithDocExtension,
} from "./modifications";

export type FhirExtension = {
  url: string;
  valueString: string;
};

export type FhirConverterParams = {
  patientId: string;
  fileName: string;
  unusedSegments: string | undefined;
  invalidAccess: string | undefined;
};

export function postProcessBundle(
  fhirBundle: Bundle<Resource>,
  patientId: string,
  documentExtension: FhirExtension
) {
  const withNewIds = replaceIdsForResourcesWithDocExtension(fhirBundle, patientId);
  const withExtensions = addExtensionToConversion(withNewIds, documentExtension);
  const withRequests = addMissingRequests(withExtensions);
  const withoutPatient = removePatientFromConversion(withRequests);
  return withoutPatient;
}
