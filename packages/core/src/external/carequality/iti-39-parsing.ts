import { generatePatientDoc } from "./docs";
import { generateTimeStrings, cleanXml, parseMtomResponseRegex } from "./utils";
import * as xml2js from "xml2js";
import { generateITI39Template, generateITI39TemplateMTOM } from "./iti-39-template";

// mapping od document ids to docs
const documentData: { [key: string]: string } = {
  "1.2.840.114350.1.13.11511.3.7.8.456721.987654": generatePatientDoc(1),
  "1.2.840.114350.1.13.11511.3.7.8.234587.334455": generatePatientDoc(2),
  "1.2.840.114350.1.13.11511.3.7.8.123456.789012": generatePatientDoc(3),
};

/**
 * Parses an XML string and extracts signature, documentId, and homeCommunityID.
 * @param xml - The XML string to be parsed.
 * @returns A promise that resolves to an array containing the signature, documentId, and homeCommunityID extracted from the XML.
 */
async function parseXmlString(xml: string): Promise<[string, string, string, string]> {
  const cleanedXml = cleanXml(parseMtomResponseRegex(xml));

  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });

  let result;
  try {
    result = await parser.parseStringPromise(cleanedXml);
  } catch (err) {
    throw new Error("XML parsing failed: Invalid XML");
  }
  try {
    const signature =
      result["Envelope"]["Header"][0]["Security"][0]["Signature"][0]["SignatureValue"][0];
    const documentId =
      result["Envelope"]["Body"][0]["RetrieveDocumentSetRequest"][0]["DocumentRequest"][0][
        "DocumentUniqueId"
      ][0];
    const homeCommunityId =
      result["Envelope"]["Body"][0]["RetrieveDocumentSetRequest"][0]["DocumentRequest"][0][
        "HomeCommunityId"
      ][0];
    const messageId = result["Envelope"]["Header"][0]["MessageID"][0];

    return [signature, documentId, homeCommunityId, messageId];
  } catch (err) {
    console.log("error", err);
    throw new Error(
      "XML parsing failed: A Required field is missing. Either signature, documentId, or homeCommunityId is missing."
    );
  }
}

const fillTemplate = (
  iti39Template: string,
  signature: string,
  createdAt: string,
  expiresAt: string,
  homeCommunityId: string,
  documentId: string,
  messageId: string,
  document?: string
) => {
  const templateVariables = {
    signature,
    createdAt,
    expiresAt,
    homeCommunityId,
    documentId,
    messageId,
    base64: document ? btoa(document) : "",
    status: document ? "Success" : "Failed",
  };

  return Object.entries(templateVariables).reduce(
    (filledTemplate, [key, value]) => filledTemplate.replace(new RegExp(`{${key}}`, "g"), value),
    iti39Template
  );
};

const fillMTOMTemplate = (
  iti39Template: string,
  signature: string,
  createdAt: string,
  expiresAt: string,
  homeCommunityId: string,
  documentId: string,
  messageId: string,
  document?: string,
  mtomDocument?: string
) => {
  const templateVariables = {
    signature,
    createdAt,
    expiresAt,
    homeCommunityId,
    documentId,
    messageId,
    base64: document ? document : "",
    status: document ? "Success" : "Failed",
    mtomDocument: mtomDocument ? btoa(mtomDocument) : "",
  };

  return Object.entries(templateVariables).reduce(
    (filledTemplate, [key, value]) => filledTemplate.replace(new RegExp(`{${key}}`, "g"), value),
    iti39Template
  );
};

export async function generateITI39(xml: string): Promise<string> {
  const [signature, documentId, homeCommunityid, messageId] = await parseXmlString(xml);
  const { createdAt, expiresAt } = generateTimeStrings();
  const document = documentData[documentId];
  const status = document ? "Success" : "Failed";
  const iti39Template = generateITI39Template(status);
  const iti39 = fillTemplate(
    iti39Template,
    signature,
    createdAt,
    expiresAt,
    homeCommunityid,
    documentId,
    messageId,
    document
  );
  return iti39;
}

export async function generateITI39MTOM(xml: string): Promise<string> {
  const [signature, documentId, homeCommunityid, messageId] = await parseXmlString(xml);
  const { createdAt, expiresAt } = generateTimeStrings();
  const mtomDocument = documentData[documentId];
  const document = `<xop:Include xmlns:xop="http://www.w3.org/2004/08/xop/include" href="cid:${documentId}"/>`;
  const status = document ? "Success" : "Failed";
  const iti39Template = generateITI39TemplateMTOM(status);
  const iti39 = fillMTOMTemplate(
    iti39Template,
    signature,
    createdAt,
    expiresAt,
    homeCommunityid,
    documentId,
    messageId,
    document,
    mtomDocument
  );
  return iti39;
}
