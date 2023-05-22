import { DocumentReference, DocumentReferenceContent, Identifier } from "@medplum/fhirtypes";
import { DocumentIdentifier } from "@metriport/commonwell-sdk";
import { MedicalDataSourceOid } from "../..";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { CWDocumentWithMetriportData } from "../../commonwell/document/shared";
import { cwExtension } from "../../commonwell/extension";
import { ResourceType } from "../shared";
import { metriportExtension } from "../shared/extension";

export const toFHIR = (
  docId: string,
  doc: CWDocumentWithMetriportData,
  organization: Organization,
  patient: Patient
): DocumentReference => {
  const baseAttachment = {
    contentType: doc.content?.mimeType,
    size: doc.content?.size,
    creation: doc.content?.indexed,
  };
  const metriportContent: DocumentReferenceContent = {
    attachment: {
      ...baseAttachment,
      title: doc.metriport.fileName,
      url: doc.metriport.location,
    },
    extension: [metriportExtension],
  };
  const cwContent = doc.content?.location
    ? [
        {
          attachment: {
            ...baseAttachment,
            title: doc.metriport.fileName, // no filename on CW doc refs
            url: doc.content.location,
          },
          extension: [cwExtension],
        },
      ]
    : [];
  return {
    id: docId,
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
    content: [...cwContent, metriportContent],
    extension: [cwExtension],
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
