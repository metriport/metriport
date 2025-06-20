import { Bundle, Resource } from "@medplum/fhirtypes";
import { createFullBundleEntries } from "../../../external/fhir/bundle/bundle";
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
  // It'ss important to add extensions before replacing IDs b/c currently replaceIdsForResourcesWithDocExtension only replaces IDs of resources with extensions (#2574 to fix that).
  // This current order guarantees that all resources have at least one extension
  const withExtensions = addExtensionToConversion(fhirBundle, documentExtension);
  const withNewIds = replaceIdsForResourcesWithDocExtension(withExtensions, patientId);
  const withRequests = createFullBundleEntries(withNewIds);
  const withoutPatient = removePatientFromConversion(withRequests);
  return withoutPatient;
}
