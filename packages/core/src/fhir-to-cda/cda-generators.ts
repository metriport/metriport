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
  cxId: string,
  fhirBundle: Bundle,
  oid: string,
  isCustodian = false
): string {
  const patientResource = findPatientResource(fhirBundle);
  const organizationResource = findOrganizationResource(fhirBundle);
  const patientId = patientResource?.id;

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
  if (!patientId) {
    throw new BadRequestError("Patient ID not found");
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

  const clinicalDocument = buildClinicalDocumentXml({
    cxId,
    recordTarget,
    author,
    custodian,
    encompassingEncounter,
    structuredBody,
    composition,
    patientId,
    documentType: "ccd",
  });

  return postProcessXml(clinicalDocument, oid);
}

function postProcessXml(xml: string, oid: string): string {
  const fullXml = prependStyling(unescapeEmbeddedMarkup(xml));
  const orgPlaceholderRegex = new RegExp(placeholderOrgOid, "g");
  return fullXml
    .replace(/<br>/g, "<br/>")
    .replace(/<\/br>/g, "")
    .replace(orgPlaceholderRegex, oid)
    .replace(/<\/text><text>/g, "");
}

const textNodeRegex = />([^<]+)</g;
const escapedTagRegex = /&lt;(\/?[A-Za-z][\w:-]*(?:\s(?:[^&<>]|&quot;|&amp;)*?)?\/?)&gt;/g;

/**
 * Narrative text can carry markup from the source, such as a note's HTML table, which the builder
 * escapes. Turn escaped tags in text nodes back into markup. Attribute values, and a "<" that
 * doesn't open a tag (e.g. a result of "<0.1"), stay escaped so the document is well-formed.
 */
function unescapeEmbeddedMarkup(xml: string): string {
  return xml.replace(textNodeRegex, (_match, text: string) => {
    const unescaped = text
      .replace(escapedTagRegex, (_tag, inner: string) => `<${inner.replace(/&quot;/g, '"')}>`)
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
    return `>${unescaped}<`;
  });
}

function prependStyling(xml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
}
