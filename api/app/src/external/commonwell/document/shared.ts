import { Document, DocumentContent } from "@metriport/commonwell-sdk";
import mime from "mime-types";
import { MedicalDataSource } from "../..";
import { DocumentReferenceCreate } from "../../../domain/medical/document-reference";
import { Patient } from "../../../models/medical/patient";
import { makePatientOID } from "../../../shared/oid";

// TODO #340 When we fix tsconfig on CW SDK we can remove the `Required` for `id`
export type DocumentWithLocation = Required<Pick<Document, "id">> &
  Omit<DocumentContent, "location"> &
  Required<Pick<DocumentContent, "location">> & {
    fileName: string;
    raw?: unknown;
  };

export function toDomain(patient: Patient) {
  return (doc: DocumentWithLocation): DocumentReferenceCreate => {
    return {
      cxId: patient.cxId,
      patientId: patient.id,
      source: MedicalDataSource.COMMONWELL,
      externalId: doc.id,
      data: {
        fileName: doc.fileName,
        location: doc.location,
        description: doc.description ?? undefined,
        status: doc.status,
        indexed: doc.indexed,
        mimeType: doc.mimeType,
        size: doc.size,
        type: doc.type,
      },
      raw: doc.raw,
    };
  };
}

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
  if (!value || !mime.contentType(value)) return "";
  const extension = mime.extension(value);
  return extension ? `.${extension}` : "";
}
