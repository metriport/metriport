import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import {
  findCompositionResource,
  findOrganizationResource,
  findPatientResource,
} from "../external/fhir/shared";
import { buildAuthor } from "./cda-templates/clinical-document/author";
import { buildClinicalDocumentXml } from "./cda-templates/clinical-document/clinical-document";
import { buildCustodian } from "./cda-templates/clinical-document/custodian";
import { buildRecordTargetFromFhirPatient } from "./cda-templates/clinical-document/record-target";
import { buildStructuredBody } from "./cda-templates/clinical-document/structured-body";
import { buildEncompassingEncounter } from "./cda-templates/components/encompassing-encounter";
import { placeholderOrgOid } from "./cda-templates/constants";

export function generateCdaFromFhirBundle(
  fhirBundle: Bundle,
  oid: string,
  isCustodian = false
): string {
  const patientResource = findPatientResource(fhirBundle);
  const organizationResource = findOrganizationResource(fhirBundle);

  if (!patientResource || !organizationResource) {
    const missing = [];
    if (!patientResource) {
      missing.push("Patient");
    }
    if (!organizationResource) {
      missing.push("Organization");
    }
    throw new BadRequestError(`${missing.join(", ")} resource(s) not found`);
  }
  const recordTarget = buildRecordTargetFromFhirPatient(patientResource);
  const author = buildAuthor(organizationResource);
  const custodian = isCustodian ? buildCustodian(organizationResource) : buildCustodian();
  const composition = findCompositionResource(fhirBundle);
  const encompassingEncounter = buildEncompassingEncounter(fhirBundle, composition);
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
    encompassingEncounter,
    structuredBody,
    composition
  );

  return postProcessXml(clinicalDocument, oid);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function postProcessXml(xml: any, oid: string): string {
  xml = prependStyling(xml);
  return xml
    .replaceAll("<br>", "<br/>")
    .replaceAll("</br>", "")
    .replaceAll(placeholderOrgOid, oid)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("</text><text>", "");
}

function prependStyling(xml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
}
