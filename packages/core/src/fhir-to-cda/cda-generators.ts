import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { XMLValidator } from "fast-xml-parser";
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
  const withLineBreaks = xml.replace(/<br>/g, "<br/>").replace(/<\/br>/g, "");
  const orgPlaceholderRegex = new RegExp(placeholderOrgOid, "g");
  return prependStyling(unescapeEmbeddedMarkup(withLineBreaks))
    .replace(orgPlaceholderRegex, oid)
    .replace(/<\/text><text>/g, "");
}

// A run of text and line breaks between two other tags: one note's narrative, spanning its lines.
const textRunRegex = />((?:[^<]|<br\/>)+)</g;
// A tag's name and attributes. A quoted value is matched whole, so a ">" inside it doesn't end the tag.
const escapedTagRegex =
  /&lt;(\/?[A-Za-z][\w:-]*(?:\s(?:[^&<>]|&quot;(?:(?!&quot;)[^<])*?&quot;|&apos;(?:(?!&apos;)[^<])*?&apos;|&amp;)*?)?\/?)&gt;/g;
const escapedCommentOrCdataRegex = /&lt;(!--[\s\S]*?--|!\[CDATA\[[\s\S]*?\]\])&gt;/g;

/**
 * Narrative text can carry markup from the source, such as a note's HTML table, which the builder
 * escapes. Turn escaped tags back into markup, one note at a time across its line breaks. A note
 * whose restored markup is not well-formed XML stays escaped and reads as text, so the document
 * stays valid whatever the source HTML looks like. Text between the tags stays escaped, since
 * "]]>" is not allowed there. Attribute values are never touched.
 */
function unescapeEmbeddedMarkup(xml: string): string {
  return xml.replace(textRunRegex, (match, run: string) => {
    if (!run.includes("&lt;")) return match;
    const restored = run
      .replace(escapedCommentOrCdataRegex, (section, inner: string) => {
        // Entities aren't expanded inside a comment or CDATA, so its content is fully decoded.
        const unescaped = inner
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&amp;/g, "&");
        return isValidCommentOrCdata(unescaped) ? `<${unescaped}>` : section;
      })
      .replace(
        escapedTagRegex,
        (_tag, inner: string) => `<${inner.replace(/&quot;/g, '"').replace(/&apos;/g, "'")}>`
      )
      .replace(/<br>/g, "<br/>")
      .replace(/<\/br>/g, "");
    const isWellFormed = XMLValidator.validate(`<note>${restored}</note>`) === true;
    return `>${isWellFormed ? restored : run}<`;
  });
}

/**
 * XML forbids "--" inside a comment and a comment ending in "-". The validator above doesn't check
 * either, so a comment that breaks the rule stays escaped.
 */
function isValidCommentOrCdata(inner: string): boolean {
  if (!inner.startsWith("!--")) return true;
  const body = inner.slice(3, -2);
  return !body.includes("--") && !body.endsWith("-");
}

function prependStyling(xml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>${xml}`;
}
