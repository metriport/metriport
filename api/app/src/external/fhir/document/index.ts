import { DocumentReference, Identifier } from "@medplum/fhirtypes";
import { MedicalDataSource } from "@metriport/api";
import { DocumentIdentifier } from "@metriport/commonwell-sdk";
import { MedicalDataSourceOid } from "../..";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { DocumentWithFilename } from "../../commonwell/document/shared";
import { ResourceType } from "../shared";

export const toFHIR = (
  doc: DocumentWithFilename,
  organization: Organization,
  patient: Patient
): DocumentReference => {
  const id = doc.id?.replace("urn:uuid:", "").replace("^", ".");

  return {
    id: id,
    resourceType: ResourceType.DocumentReference,
    contained: [
      {
        resourceType: ResourceType.Organization,
        id: organization.id,
        name: organization.data.name,
      },
      {
        resourceType: ResourceType.Patient,
        id: patient.id,
      },
    ],
    masterIdentifier: {
      system: doc.content?.masterIdentifier?.system,
      value: doc.content?.masterIdentifier?.value,
    },
    identifier: doc.content?.identifier?.map(idToFHIR),
    date: doc.content?.indexed,
    status: "current",
    type: doc.content?.type,
    subject: {
      reference: `Patient/${patient.id}`,
      type: ResourceType.Patient,
    },
    author: [
      {
        reference: `#${organization.id}`,
        type: ResourceType.Organization,
      },
    ],
    // DEFAULT TO COMMONWELL FOR NOW
    custodian: {
      id: MedicalDataSourceOid.COMMONWELL,
    },
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

// TODO once we merge DocumentIdentifier with Identifier on CW SDK, let's move this to
// an identifier-specific file
export function idToFHIR(id: DocumentIdentifier): Identifier {
  return {
    system: id.system,
    value: id.value,
    use: id.use === "unspecified" ? undefined : id.use,
  };
}
