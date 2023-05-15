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

const NON_HL7_SUFFIX = "-M-";

export function encodeExternalId(decodedId: string): string {
  const hasHl7Prefix = decodedId.includes(HL7OID);
  const idToEncode = hasHl7Prefix ? decodedId.replace(HL7OID, "") : NON_HL7_SUFFIX + decodedId;
  return base64url.encode(idToEncode);
}
export function decodeExternalId(encodedId: string): string {
  const decoded = base64url.decode(encodedId);
  if (decoded.startsWith(NON_HL7_SUFFIX)) {
    const res = decoded.replace(NON_HL7_SUFFIX, "");
    return res;
  }
  return HL7OID + base64url.decode(encodedId);
}
