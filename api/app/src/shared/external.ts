import { Document } from "@metriport/commonwell-sdk";
import base64url from "base64url";
import { HL7OID } from "../external";

export const createS3FileName = (cxId: string, fileName: string): string => {
  return `${cxId}-${fileName}`;
};

export const getDocumentPrimaryId = (document: Document): string => {
  const id = document.content?.masterIdentifier?.value || document.id;
  return encodeExternalId(id);
};

const HL7_SUFFIX = ".";

export function encodeExternalId(decodedId: string): string {
  const hasHl7Prefix = decodedId.includes(HL7OID);
  const idToEncode = hasHl7Prefix ? decodedId.replace(HL7OID, "") : decodedId;
  return base64url.encode(idToEncode);
}
export function decodeExternalId(encodedId: string): string {
  const decoded = base64url.decode(encodedId);
  if (decoded.startsWith(HL7_SUFFIX)) {
    return HL7OID + decoded;
  }
  return decoded;
}
