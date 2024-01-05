import { Document } from "@metriport/commonwell-sdk";
import { contentType, extension } from "mime-types";
import { Patient } from "@metriport/core/domain/medical/patient";

export const sandboxSleepTime = 5000;

export type DocumentWithMetriportId = Document & {
  originalId: string;
};

export type DocumentWithLocation = DocumentWithMetriportId & { content: { location: string } };

export type CWDocumentWithMetriportData = DocumentWithMetriportId & {
  metriport: {
    fileName: string;
    location: string;
    fileSize: number | undefined;
    fileContentType: string | undefined;
  };
};

export function getFileName(patient: Patient, doc: Document): string {
  const prefix = "document_" + patient.id;
  const display = doc.content?.type?.coding?.length
    ? doc.content?.type.coding[0]?.display
    : undefined;
  const suffix = getSuffix(doc.id);
  const extension = getFileExtension(doc.content?.mimeType);
  const fileName = `${prefix}_${display ? display + "_" : display}${suffix}${extension}`;
  return fileName.replace(/\s/g, "-");
}

function getSuffix(id: string | undefined): string {
  if (!id) return "";
  return id.replace("urn:uuid:", "");
}

export function getFileExtension(value: string | undefined): string {
  if (!value || !contentType(value)) return "";
  const fileExtension = extension(value);
  return fileExtension ? `.${fileExtension}` : "";
}
