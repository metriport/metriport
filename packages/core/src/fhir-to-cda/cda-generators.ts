import { Bundle, Patient, Organization } from "@medplum/fhirtypes";
import { constructRecordTargetFromFhirPatient } from "./cda-templates/record-target";
import { constructAuthor } from "./cda-templates/author";
import { constructCustodian } from "./cda-templates/custodian";
import { constructClinicalDocumentXML } from "./cda-templates/clinical-document";

export function generateCdaFromFhirBundle(fhirBundle: Bundle): string {
  const patientResource = fhirBundle.entry?.find(
    entry => entry.resource?.resourceType === "Patient"
  )?.resource as Patient;
  const organizationResources = fhirBundle.entry?.find(
    entry => entry.resource?.resourceType === "Organization"
  )?.resource as Organization;

  const recordTarget = constructRecordTargetFromFhirPatient(patientResource);
  const author = constructAuthor(organizationResources);
  const custodian = constructCustodian();
  const clinicalDocument = constructClinicalDocumentXML(recordTarget, author, custodian);
  return clinicalDocument;
}
