import { Document } from "@metriport/commonwell-sdk";
import { contentType, extension } from "mime-types";
import { Patient } from "../../../models/medical/patient";
import { makePatientOID } from "../../../shared/oid";

export type DocumentWithFilename = Document & {
  fileName: string;
  raw?: unknown;
};

export function getFileName(patient: Patient, doc: Document): string {
  const prefix = "document_" + makePatientOID("", patient.patientNumber).substring(1);
  const display = doc.content?.type?.coding?.length
    ? doc.content?.type.coding[0].display
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

function getFileExtension(value: string | undefined): string {
  if (!value || !contentType(value)) return "";
  const fileExtension = extension(value);
  return fileExtension ? `.${fileExtension}` : "";
}
