import { Bundle, Organization, Patient } from "@medplum/fhirtypes";
import { MetriportError } from "../util/error/metriport-error";
import { buildAuthor } from "./cda-templates/clinical-document/author";
import { buildClinicalDocumentXML } from "./cda-templates/clinical-document/clinical-document";
import { buildCustodian } from "./cda-templates/clinical-document/custodian";
import { buildRecordTargetFromFhirPatient } from "./cda-templates/clinical-document/record-target";
import { buildStructuredBody } from "./cda-templates/clinical-document/structured-body";
import { findOrganizationResource, findPatientResource } from "./fhir";

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
