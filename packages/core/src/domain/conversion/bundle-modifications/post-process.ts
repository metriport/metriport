import { Bundle, Resource } from "@medplum/fhirtypes";
import { createFullBundleEntries } from "../../../external/fhir/shared/bundle";
import {
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

export function postProcessBundle(fhirBundle: Bundle<Resource>, patientId: string) {
  const withNewIds = replaceIdsForResourcesWithDocExtension(fhirBundle, patientId);
  const withRequests = createFullBundleEntries(withNewIds);
  const withoutPatient = removePatientFromConversion(withRequests);
  return withoutPatient;
}
