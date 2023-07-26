import dayjs from "dayjs";
import { DocumentReference } from "@medplum/fhirtypes";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { getOrganizationOrFail } from "../organization/get-organization";
import { getPatientOrFail } from "../patient/get-patient";
import { Config } from "../../../shared/config";
import { createMetriportDocReferenceContent } from "../../../external/fhir/document";

const docContributionUrl = Config.getDocContributionUrl();

/**
 * ADMIN LOGIC
 * This function is to be able to create a document reference
 * and upload it to the FHIR server with the purpose of testing.
 */

export async function createAndUploadDocReference({
  cxId,
  patientId,
  docId,
  file,
  metadata,
}: {
  cxId: string;
  patientId: string;
  docId: string;
  file: Express.Multer.File;
  metadata: {
    description: string;
  };
}): Promise<DocumentReference> {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  const organization = await getOrganizationOrFail({ cxId });

  const fhirApi = makeFhirApi(cxId);

  const now = dayjs();

  const metriportContent = createMetriportDocReferenceContent({
    contentType: file.mimetype,
    size: file.size,
    creation: now.format(),
    fileName: file.originalname,
    location: `${docContributionUrl}?fileName=${file.originalname}`,
  });

  // WHEN OPENING THIS FOR CX'S NEED TO UPDATE THE CONTENT
  const data: DocumentReference = {
    resourceType: "DocumentReference",
    id: docId,
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
      system: "urn:ietf:rfc:3986",
      value: docId,
    },
    identifier: [
      {
        use: "official",
        system: "urn:ietf:rfc:3986",
        value: docId,
      },
    ],
    status: "current",
    type: {
      coding: [
        {
          system: "http://loinc.org/",
          code: "75622-1",
          display: metadata.description,
        },
      ],
    },
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
    description: metadata.description,
    content: [metriportContent],
    context: {
      period: {
        start: now.format(),
        end: now.add(1, "hour").format(),
      },
      sourcePatientInfo: {
        reference: `#${patient.id}`,
        type: "Patient",
      },
    },
  };

  await fhirApi.updateResource(data);

  return data;
}
