import { generatePatientDoc } from "./docs";
import { generateTimeStrings } from "./utils";
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
async function parseXmlString(xml: string): Promise<[string, string, string]> {
  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });

  try {
    const result = await parser.parseStringPromise(xml);
    const signature =
      result["Envelope"]["Header"][0]["Security"][0]["Signature"][0]["SignatureValue"][0];
    const documentId =
      result["Envelope"]["Body"][0]["RetrieveDocumentSetRequest"][0]["DocumentRequest"][0][
        "DocumentUniqueId"
      ];
    const homeCommunityId =
      result["Envelope"]["Body"][0]["RetrieveDocumentSetRequest"][0]["DocumentRequest"][0][
        "HomeCommunityId"
      ];

    return [signature, documentId, homeCommunityId];
  } catch (err) {
    console.log("error", err);
    throw new Error("Invalid XML");
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

export async function generateITI39(xml: string): Promise<string> {
  try {
    const [signature, documentId, homeCommunityid] = await parseXmlString(xml);
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
  } catch (error) {
    console.error(error);
    throw new Error("XML parsing failed");
  }
}
