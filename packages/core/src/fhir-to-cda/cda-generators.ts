import { Bundle, Patient, Organization } from "@medplum/fhirtypes";
import { buildRecordTargetFromFhirPatient } from "./cda-templates/clinical-document/record-target";
import { buildAuthor } from "./cda-templates/clinical-document/author";
import { buildCustodian } from "./cda-templates/clinical-document/custodian";
import { buildStructuredBody } from "./cda-templates/clinical-document/structured-body";
import { buildClinicalDocumentXML } from "./cda-templates/clinical-document/clinical-document";
import { findPatientResource, findOrganizationResource } from "./fhir";
import { MetriportError } from "../util/error/metriport-error";

export function generateCdaFromFhirBundle(fhirBundle: Bundle): string {
  const patientResource: Patient | undefined = findPatientResource(fhirBundle);
  const organizationResources: Organization | undefined = findOrganizationResource(fhirBundle);

  if (!patientResource || !organizationResources) {
    throw new MetriportError("Required resource is missing.", fhirBundle);
  }

  const recordTarget = buildRecordTargetFromFhirPatient(patientResource);
  const author = buildAuthor(organizationResources);
  const custodian = buildCustodian();
  const structuredBody = buildStructuredBody(fhirBundle);

  if (!recordTarget || !author || !custodian || !structuredBody) {
    throw new MetriportError(
      "Missing required CDA components. Failed to generate CDA.",
      fhirBundle
    );
  }

  const clinicalDocument = buildClinicalDocumentXML(
    recordTarget,
    author,
    custodian,
    structuredBody
  );
  return clinicalDocument;
}
