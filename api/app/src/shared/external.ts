import { Document } from "@metriport/commonwell-sdk";
import base64url from "base64url";

export const createS3FileName = (cxId: string, fileName: string): string => {
  return `${cxId}-${fileName}`;
};

export const getDocumentPrimaryId = (document: Document): string => {
  const id = document.content?.masterIdentifier?.value || document.id;
  return base64url.encode(id);
};
