import { MedicalDataSource } from "@metriport/api";
import { DocumentReference } from "@medplum/fhirtypes";
import { DocumentWithFilename } from "../../commonwell/document/shared";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";

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
