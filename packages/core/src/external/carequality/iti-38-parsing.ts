import { generateTimeStrings } from "./utils";
import * as xml2js from "xml2js";
import { generateITI38Template } from "./iti-38-template";

// Mapping of patientIds to DocumentIds
const patientToDocumentLinks: { [key: string]: string } = {
  EV38NJT4M6Q2B5X: "1.2.840.114350.1.13.11511.3.7.8.456721.987654",
  EV72KHP9L1C3FA4: "1.2.840.114350.1.13.11511.3.7.8.234587.334455",
  EV51WRZ8G7D6H9Y: "1.2.840.114350.1.13.11511.3.7.8.123456.789012",
};

/**
 * Parses an XML string and extracts patientId, sytemId (homeCommunityId), signature, and messageId.
 * @param xml - The XML string to be parsed.
 * @returns A promise that resolves to an array containing the patientId, systemId, signature, and messageId extracted from the XML.
 */
async function parseXmlString(xml: string): Promise<[string, string, string, string]> {
  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try {
    const result = await parser.parseStringPromise(xml);
    const signature =
      result["Envelope"]["Header"][0]["Security"][0]["Signature"][0]["SignatureValue"][0];
    const messageId = result["Envelope"]["Header"][0]["MessageID"][0]["_"];
    const id = result["Envelope"]["Body"][0]["AdhocQueryRequest"][0]["AdhocQuery"][0];
    const [patientId, systemId] = extractPatientAndSystemId(id);
    return [patientId, systemId, signature, messageId];
  } catch (err) {
    console.log("error", err);
    throw new Error("Invalid XML");
  }
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPatientAndSystemId(id: any): [string, string] {
  let patientId = "";
  let systemId = "";

  if (id && id.Slot) {
    for (const slot of id.Slot) {
      if (slot.$ && slot.$.name === "$XDSDocumentEntryPatientId") {
        const value = slot.ValueList[0].Value[0];
        const parts = value.split("^^^&");
        patientId = parts[0].replace(/'/g, ""); // remove single quotes
        systemId = parts[1].split("&")[0];
        break;
      }
    }
  }

  return [patientId, systemId];
}

const fillTemplate = (
  iti38Template: string,
  signature: string,
  createdAt: string,
  expiresAt: string,
  patientId: string,
  systemId: string,
  messageId: string,
  documentId?: string
) => {
  const templateVariables = {
    signature,
    createdAt,
    expiresAt,
    patientId,
    systemId,
    messageId,
    documentId: documentId || "",
    status: documentId ? "Success" : "Failed",
  };

  return Object.entries(templateVariables).reduce(
    (filledTemplate, [key, value]) => filledTemplate.replace(new RegExp(`{${key}}`, "g"), value),
    iti38Template
  );
};

export async function generateITI38(xml: string): Promise<string> {
  try {
    const [patientId, systemId, signature, messageId] = await parseXmlString(xml);
    const { createdAt, expiresAt } = generateTimeStrings();
    const documentId = patientToDocumentLinks[patientId];
    const iti38Template = generateITI38Template(documentId ? "Success" : "Failed");
    const iti38 = fillTemplate(
      iti38Template,
      signature,
      createdAt,
      expiresAt,
      patientId,
      systemId,
      messageId,
      documentId
    );
    return iti38;
  } catch (error) {
    console.error(error);
    throw new Error("Invalid XML");
  }
}
