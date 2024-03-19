import { Bundle, Patient, Organization } from "@medplum/fhirtypes";
import { buildRecordTargetFromFhirPatient } from "./cda-templates/record-target";
import { buildAuthor } from "./cda-templates/author";
import { buildCustodian } from "./cda-templates/custodian";
import { buildStructuredBody } from "./cda-templates/structured-body";
import { buildClinicalDocumentXML } from "./cda-templates/clinical-document";

export function generateCdaFromFhirBundle(fhirBundle: Bundle): string {
  const patientResource = fhirBundle.entry?.find(
    entry => entry.resource?.resourceType === "Patient"
  )?.resource as Patient;
  const organizationResources = fhirBundle.entry?.find(
    entry => entry.resource?.resourceType === "Organization"
  )?.resource as Organization;

  const recordTarget = buildRecordTargetFromFhirPatient(patientResource);
  const author = buildAuthor(organizationResources);
  const custodian = buildCustodian();
  const structuredBody = buildStructuredBody(fhirBundle);

  if (!recordTarget || !author || !custodian || !structuredBody) {
    throw new Error("Missing required CDA components. Failed to generate CDA.");
  }

  const clinicalDocument = buildClinicalDocumentXML(
    recordTarget,
    author,
    custodian,
    structuredBody
  );
  return clinicalDocument;
}
