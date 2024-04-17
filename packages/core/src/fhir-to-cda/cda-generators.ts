import { Bundle, Organization, Patient } from "@medplum/fhirtypes";
import { MetriportError } from "../util/error/metriport-error";
import NotFoundError from "../util/error/not-found";
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
    const missing = [];
    if (!patientResource) {
      missing.push("Patient");
    }
    if (!organizationResources) {
      missing.push("Organization"); // TODO: organization shouldn't actually be required
    }
    const additionalInfo = { missing: missing.join(", ") }; // TODO: This is a bit of a hack. We should probably have a better way to handle this.

    throw new MetriportError(
      "Required resource is missing.",
      new NotFoundError("Resource(s) not found"),
      additionalInfo
    );
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
    const additionalInfo = { missing: missing.join(", ") };

    throw new MetriportError(
      "Missing required CDA components. Failed to generate CDA.",
      new NotFoundError("Resource(s) not found"),
      additionalInfo
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
