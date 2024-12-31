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
  const withNewIds = replaceIdsForResourcesWithDocExtension(fhirBundle, patientId);
  const withExtensions = addExtensionToConversion(withNewIds, documentExtension);
  const withRequests = createFullBundleEntries(withExtensions);
  const withoutPatient = removePatientFromConversion(withRequests);
  return withoutPatient;
}
