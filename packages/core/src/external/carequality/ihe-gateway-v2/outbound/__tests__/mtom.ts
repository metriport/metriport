import {
  parseMtomResponse,
  getBoundaryFromMtomResponse,
  MtomAttachments,
} from "../xca/mtom/parser";
import { createMtomContentTypeAndPayload } from "../xca/mtom/builder";

const boundary = "a1109b32-0907-4c3c-9d61-8b8d846b9983";
const contentId0 = "<0.doc@metriport.com>";
const carriageReturn = "\r\n";

export async function createMtomMessageWithAttachments(
  attachmentsData: { payload: Buffer; mimeType: string }[]
): Promise<MtomAttachments> {
  const documentResponses = attachmentsData
    .map((attachment, index) => {
      const contentId = `${index + 1}.doc@metriport.com`;
      const mimeType = attachment.mimeType;
      return `<DocumentResponse>
        <HomeCommunityId>urn:oid:2.16.840.1.113883.3.6147.3187.119953613117321.1</HomeCommunityId>
        <RepositoryUniqueId>urn:oid:2.16.840.1.113883.3.6147.3187.119953613117321.1</RepositoryUniqueId>
        <DocumentUniqueId>123456789</DocumentUniqueId>
        <mimeType>${mimeType}</mimeType>
        <Document>
          <xop:Include href="cid:${contentId}" xmlns:xop="http://www.w3.org/2004/08/xop/include"/>
        </Document>
      </DocumentResponse>`;
    })
    .join("");

  const mtomMessageHeader = Buffer.from(
    `--${boundary}${carriageReturn}` +
      `content-type: application/xop+xml; charset=UTF-8; type="application/soap+xml"${carriageReturn}` +
      `content-transfer-encoding: binary${carriageReturn}` +
      `content-id: ${contentId0}${carriageReturn}${carriageReturn}` +
      `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing"><s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"> <RetrieveDocumentSetResponse xmlns="urn:ihe:iti:xds-b:2007"><RegistryResponse status="urn:oasis:names:tc:ebxml-regrep:ResponseStatusType:Success" xmlns="urn:oasis:names:tc:ebxml-regrep:xsd:rs:3.0"></RegistryResponse>${documentResponses}</RetrieveDocumentSetResponse></s:Body></s:Envelope>${carriageReturn}${carriageReturn}`,
    "utf-8"
  );

  const attachments = attachmentsData.map((attachment, index) => {
    const contentId = `<${index + 1}.doc@metriport.com>`;
    return Buffer.concat([
      Buffer.from(
        `--${boundary}${carriageReturn}` +
          `Content-ID: ${contentId}${carriageReturn}` +
          `content-transfer-encoding: binary${carriageReturn}` +
          `Content-Type: ${attachment.mimeType};${carriageReturn}${carriageReturn}`,
        "utf-8"
      ),
      attachment.payload,
      Buffer.from(carriageReturn, "utf-8"),
    ]);
  });

  const mtomMessageFooter = Buffer.from(`--${boundary}--${carriageReturn}`, "utf-8");

  const finalMessage = Buffer.concat([mtomMessageHeader, ...attachments, mtomMessageFooter]);
  const parts = await parseMtomResponse(finalMessage, boundary);
  return parts;
}

export async function createMtomMessageWithoutAttachments(
  xmlString: string
): Promise<MtomAttachments> {
  const { payload, contentType } = createMtomContentTypeAndPayload(xmlString);
  const boundary = getBoundaryFromMtomResponse(contentType);
  if (!boundary) {
    throw new Error("No boundary parameter found in content type.");
  }
  return parseMtomResponse(payload, boundary);
}
