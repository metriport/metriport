import { generateTimeStrings } from "./utils";
import * as xml2js from "xml2js";
import { generateITI38Template } from "./iti-38-template";

// TODO make IDs real
const patientToDocumentLinks: { [key: string]: string } = {
  EV10045900: "123456",
  EV72KHP9L1C3FA4: "234567",
  EV51WRZ8G7D6H9Y: "345678",
};

export function parseXmlStringForPatientIdSystemSignature(
  xml: string
): Promise<[string, string, string, string]> {
  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parser.parseStringPromise(xml).then(function (result: any) {
    const signature =
      result["Envelope"]["Header"][0]["Security"][0]["Signature"][0]["SignatureValue"][0];
    const messageId = result["Envelope"]["Header"][0]["MessageID"][0]["_"];
    const id = result["Envelope"]["Body"][0]["AdhocQueryRequest"][0]["AdhocQuery"][0];
    const [patientId, systemId] = extractPatientAndSystemId(id);
    return [patientId, systemId, signature, messageId];
  });
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
  if (documentId) {
    return iti38Template
      .replace(/{signature}/g, signature)
      .replace(/{createdAt}/g, createdAt)
      .replace(/{expiresAt}/g, expiresAt)
      .replace(/{patientId}/g, patientId)
      .replace(/{systemId}/g, systemId)
      .replace(/{messageId}/g, messageId)
      .replace(/{documentId}/g, documentId)
      .replace(/{status}/g, "Success");
  } else {
    return iti38Template
      .replace(/{signature}/g, signature)
      .replace(/{createdAt}/g, createdAt)
      .replace(/{expiresAt}/g, expiresAt)
      .replace(/{patientId}/g, patientId)
      .replace(/{systemId}/g, systemId)
      .replace(/{messageId}/g, messageId)
      .replace(/{status}/g, "Failed");
  }
};

export function generateITI38(xml: string): Promise<string> {
  return parseXmlStringForPatientIdSystemSignature(xml).then(
    ([patientId, systemId, signature, messageId]: [string, string, string, string]) => {
      const { createdAt, expiresAt } = generateTimeStrings();
      const documentId = patientToDocumentLinks[patientId];
      const status = documentId ? "Success" : "Failed";
      const iti38Template = generateITI38Template(status);
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
    }
  );
}
