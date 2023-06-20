import { Document } from "@metriport/commonwell-sdk";
import base64url from "base64url";
import { HL7OID } from "../external";

export const createS3FileName = (cxId: string, patientId: string, fileName: string): string => {
  return `${cxId}/${patientId}/${cxId}_${patientId}_${fileName}`;
};

export const getDocumentPrimaryId = (document: Document): string => {
  const id = document.content?.masterIdentifier?.value || document.id;
  return encodeExternalId(id);
};

const HL7_SUFFIX = ".";
const otherKnownOIDs: Record<number, string> = {
  0: "urn:uuid:",
  1: "urn:oid:1.2.840.114350",
  2: "urn:oid:2.25",
  3: "urn:oid:1.3.6.1.4.1.22812",
};
const otherKnownOIDValues = Object.values(otherKnownOIDs);

const otherKnownOIDRegex = new RegExp(/^-\d{1,2}-/);

export function encodeExternalId(decodedId: string): string {
  const hasHl7Prefix = decodedId.includes(HL7OID);
  const hasOtherPrefix = otherKnownOIDValues.findIndex(oid => decodedId.startsWith(oid));
  const idToEncode = hasHl7Prefix
    ? decodedId.replace(HL7OID, "")
    : hasOtherPrefix >= 0
    ? `-${hasOtherPrefix}-` + decodedId.replace(otherKnownOIDs[hasOtherPrefix] ?? "", "")
    : decodedId;
  return base64url.encode(idToEncode);
}
export function decodeExternalId(encodedId: string): string {
  const decoded = base64url.decode(encodedId);
  if (decoded.startsWith(HL7_SUFFIX)) {
    return HL7OID + decoded;
  }
  const match = decoded.match(otherKnownOIDRegex);
  const otherPrefix = match ? match[0] : undefined;
  if (otherPrefix) {
    const index = parseInt(otherPrefix.replace(/-/g, ""));
    return otherKnownOIDs[index] + decoded.replace(otherKnownOIDRegex, "");
  }
  return decoded;
}
