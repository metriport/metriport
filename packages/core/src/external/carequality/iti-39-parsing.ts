import { generatePatientDoc } from "./docs";
import { generateTimeStrings, cleanXml, parseMtomResponse } from "./utils";
import * as xml2js from "xml2js";
import { generateITI39Template } from "./iti-39-template";

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
async function parseXmlString(xml: string, header: string): Promise<[string, string, string]> {
  const cleanedXml = cleanXml(parseMtomResponse(xml, header));

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
    console.log("homeCommunity", homeCommunityId);
    console.log("documentId", documentId);
    return [signature, documentId, homeCommunityId];
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
  document?: string
) => {
  const templateVariables = {
    signature,
    createdAt,
    expiresAt,
    homeCommunityId,
    documentId,
    base64: document ? btoa(document) : "",
    status: document ? "Success" : "Failed",
  };

  return Object.entries(templateVariables).reduce(
    (filledTemplate, [key, value]) => filledTemplate.replace(new RegExp(`{${key}}`, "g"), value),
    iti39Template
  );
};

export async function generateITI39(xml: string, header: string): Promise<string> {
  const [signature, documentId, homeCommunityid] = await parseXmlString(xml, header);
  const { createdAt, expiresAt } = generateTimeStrings();
  const document = documentData[documentId];
  const status = document ? "Success" : "Failed";
  const iti39Template = generateITI39Template(status);
  const iti38 = fillTemplate(
    iti39Template,
    signature,
    createdAt,
    expiresAt,
    homeCommunityid,
    documentId,
    document
  );
  return iti38;
}
