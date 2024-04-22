import { Bundle } from "@medplum/fhirtypes";
import { findOrganizationResource, findPatientResource } from "../external/fhir/shared";
import NotFoundError from "../util/error/not-found";
import { buildAuthor } from "./cda-templates/clinical-document/author";
import { buildClinicalDocumentXML } from "./cda-templates/clinical-document/clinical-document";
import { buildCustodian } from "./cda-templates/clinical-document/custodian";
import { buildRecordTargetFromFhirPatient } from "./cda-templates/clinical-document/record-target";
import { buildStructuredBody } from "./cda-templates/clinical-document/structured-body";

export function generateCdaFromFhirBundle(fhirBundle: Bundle): string {
  const patientResource = findPatientResource(fhirBundle);
  const organizationResources = findOrganizationResource(fhirBundle);

  if (!patientResource || !organizationResources) {
    const missing = [];
    if (!patientResource) {
      missing.push("Patient");
    }
    if (!organizationResources) {
      missing.push("Organization");
    }
    throw new NotFoundError(`${missing.join(", ")} resource(s) not found`);
  }

  const recordTarget = buildRecordTargetFromFhirPatient(patientResource);
  const author = buildAuthor(organizationResources);
  const custodian = buildCustodian();
  const structuredBody = buildStructuredBody(fhirBundle);

  if (!recordTarget || !author || !custodian || !structuredBody) {
    const missing = [];
    if (!recordTarget) {
      missing.push("recordTarget");
    }
    if (!author) {
      missing.push("author");
    }
    if (!custodian) {
      missing.push("custodian");
    }
    if (!structuredBody) {
      missing.push("structuredBody");
    }

    throw new NotFoundError(`${missing.join(", ")} resource(s) not found`);
  }

  const clinicalDocument = buildClinicalDocumentXML(
    recordTarget,
    author,
    custodian,
    structuredBody
  );
  return clinicalDocument;
}
