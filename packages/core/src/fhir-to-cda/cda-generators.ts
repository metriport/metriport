import { Bundle, Patient } from "@medplum/fhirtypes";
import { constructRecordTargetFromFhirPatient } from "./cda-templates/record-target";
import { constructClinicalDocumentXML } from "./cda-templates/clinical-document";

export function generateCdaFromFhirBundle(fhirBundle: Bundle): string {
  const patientResource = fhirBundle.entry?.find(
    entry => entry.resource?.resourceType === "Patient"
  )?.resource as Patient;
  //   const organizationResources = fhirBundle.entry
  //     ?.filter(entry => entry.resource?.resourceType === "Organization")
  //     .map(entry => entry.resource);
  const recordTarget = constructRecordTargetFromFhirPatient(patientResource);
  const clinicalDocument = constructClinicalDocumentXML(recordTarget);
  return clinicalDocument;
}
