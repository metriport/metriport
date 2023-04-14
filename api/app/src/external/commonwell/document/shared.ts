import { Document } from "@metriport/commonwell-sdk";
import mime from "mime-types";
import { DocumentReference } from "@medplum/fhirtypes";
import { Patient } from "../../../models/medical/patient";
import { Organization } from "../../../models/medical/organization";
import { makePatientOID } from "../../../shared/oid";
import { MedicalDataSource } from "../..";

// TODO #340 When we fix tsconfig on CW SDK we can remove the `Required` for `id`
export type DocumentWithFilename = Document & {
  fileName: string;
};

export const toFHIR = (
  doc: DocumentWithFilename,
  organization: Organization,
  patient: Patient
): DocumentReference => {
  const id = doc.id?.replace("urn:uuid:", "");

  return {
    id: id,
    resourceType: "DocumentReference",
    contained: [
      {
        resourceType: "Organization",
        id: organization.id,
        name: organization.data.name,
      },
      {
        resourceType: "Patient",
        id: patient.id,
      },
    ],
    masterIdentifier: {
      system: doc.content?.masterIdentifier?.system,
      value: doc.content?.masterIdentifier?.value,
    },
    identifier: doc.content?.identifier?.map(id => {
      return {
        system: id.system,
        value: id.value,
        // question
        // use: id.use,
      };
    }),
    date: doc.content?.indexed,
    status: "current",
    type: doc.content?.type,
    subject: {
      reference: `Patient/${patient.id}`,
      type: "Patient",
    },
    author: [
      {
        reference: `#${organization.id}`,
        type: "Organization",
      },
    ],
    description: doc.content?.description,
    content: [
      {
        attachment: {
          title: doc.fileName,
          contentType: doc.content?.mimeType,
          url: doc.content?.location,
          size: doc.content?.size,
          creation: doc.content?.indexed,
        },
      },
    ],
    extension: [
      {
        valueReference: {
          reference: MedicalDataSource.COMMONWELL,
        },
      },
    ],
    context: doc.content?.context,
  };
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
  if (!value || !mime.contentType(value)) return "";
  const extension = mime.extension(value);
  return extension ? `.${extension}` : "";
}
