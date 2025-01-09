import { Bundle, Resource } from "@medplum/fhirtypes";
import { createFullBundleEntries } from "../../../external/fhir/shared/bundle";
import {
  addExtensionToConversion,
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
  const withExtensions = addExtensionToConversion(fhirBundle, documentExtension);
  const withNewIds = replaceIdsForResourcesWithDocExtension(withExtensions, patientId);
  const withRequests = createFullBundleEntries(withNewIds);
  const withoutPatient = removePatientFromConversion(withRequests);
  return withoutPatient;
}
