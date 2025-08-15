import { DocumentReference, Content } from "@metriport/commonwell-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { getFileExtension } from "@metriport/core/util/mime";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export const sandboxSleepTime = dayjs.duration({ seconds: 5 });

export type DocumentWithMetriportId = DocumentReference & {
  originalId: string;
};

export type DocumentWithLocation = DocumentWithMetriportId & {
  content: [Content, ...Content[]];
};

export type CWDocumentWithMetriportData = DocumentWithMetriportId & {
  metriport: {
    fileName: string;
    location: string;
    fileSize: number | undefined;
    fileContentType: string | undefined;
  };
};

export function getFileName(patient: Patient, doc: DocumentReference): string {
  const prefix = "document_" + patient.id;
  const display = doc.type?.coding?.length ? doc.type.coding[0]?.display : undefined;
  const suffix = getSuffix(doc.id ?? doc.identifier?.[0]?.value);
  const extension = getFileExtension(doc.content?.[0]?.attachment.contentType ?? undefined);
  const fileName = `${prefix}_${display ? display + "_" : display}${suffix}${extension}`;
  return fileName.replace(/\s/g, "-");
}

function getSuffix(id: string | undefined): string {
  if (!id) return "";
  return id.replace("urn:uuid:", "");
}

export function getContentTypeOrUnknown(doc: DocumentReference): string {
  return doc.content?.[0]?.attachment.contentType ?? "unknown";
}
