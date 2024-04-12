import { Bundle, Organization, Patient } from "@medplum/fhirtypes";
import { MetriportError } from "../util/error/metriport-error";
import { buildAuthor } from "./cda-templates/clinical-document/author";
import { buildClinicalDocumentXML } from "./cda-templates/clinical-document/clinical-document";
import { buildCustodian } from "./cda-templates/clinical-document/custodian";
import { buildRecordTargetFromFhirPatient } from "./cda-templates/clinical-document/record-target";
import { buildStructuredBody } from "./cda-templates/clinical-document/structured-body";
import { findOrganizationResource, findPatientResource } from "./fhir";
import { placeholderOrgOid } from "./cda-templates/constants";

export function generateCdaFromFhirBundle(fhirBundle: Bundle, oid: string): string {
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

  const postProcessedXml = postProcessXml(clinicalDocument, oid);
  return postProcessedXml;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function postProcessXml(xml: any, oid: string): string {
  return xml
    .replaceAll("<br>", "")
    .replaceAll("</br>", "<br />")
    .replaceAll(placeholderOrgOid, oid);
}
