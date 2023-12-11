import { generatePatientDoc } from "./docs";
import { generateTimeStrings } from "./utils";
import * as xml2js from "xml2js";
import { generateITI39Template } from "./iti-39-template";

// todo make this have the values we want
const documentData: { [key: string]: string } = {
  "1.2.840.114350.1.13.11511.3.7.8.456721.987654": generatePatientDoc(1),
  "1.2.840.114350.1.13.11511.3.7.8.234587.334455": generatePatientDoc(2),
  "1.2.840.114350.1.13.11511.3.7.8.123456.789012": generatePatientDoc(3),
};

export function parseXmlStringForDocumentIdCommunityIdSignature(
  xml: string
): Promise<[string, string, string]> {
  const parser = new xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parser.parseStringPromise(xml).then(function (result: any) {
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
  });
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
  if (document) {
    const base64 = btoa(document);
    return iti39Template
      .replace(/{signature}/g, signature)
      .replace(/{createdAt}/g, createdAt)
      .replace(/{expiresAt}/g, expiresAt)
      .replace(/{homeCommunityId}/g, homeCommunityId)
      .replace(/{documentId}/g, documentId)
      .replace(/{base64}/g, base64)
      .replace(/{status}/g, "Success");
  } else {
    return iti39Template
      .replace(/{signature}/g, signature)
      .replace(/{createdAt}/g, createdAt)
      .replace(/{expiresAt}/g, expiresAt)
      .replace(/{status}/g, "Failed");
  }
};

export function generateITI39(xml: string): Promise<string> {
  return parseXmlStringForDocumentIdCommunityIdSignature(xml).then(
    ([signature, documentId, homeCommunityid]: [string, string, string]) => {
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
  );
}
