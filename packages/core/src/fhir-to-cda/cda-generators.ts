import { Bundle } from "@medplum/fhirtypes";
import { findOrganizationResource, findPatientResource } from "../external/fhir/shared";
import BadRequestError from "../util/error/bad-request";
import { buildAuthor } from "./cda-templates/clinical-document/author";
import { buildClinicalDocumentXml } from "./cda-templates/clinical-document/clinical-document";
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
    throw new BadRequestError(`${missing.join(", ")} resource(s) not found`);
  }

  const recordTarget = buildRecordTargetFromFhirPatient(patientResource);
  const author = buildAuthor(organizationResources);
  const custodian = buildCustodian();
  const structuredBody = buildStructuredBody(fhirBundle);

  if (!structuredBody) {
    throw new BadRequestError(
      `The FHIR bundle is missing meaningful data to generate a CDA document.`
    );
  }

  const clinicalDocument = buildClinicalDocumentXml(
    recordTarget,
    author,
    custodian,
    structuredBody
  );
  return clinicalDocument;
}
