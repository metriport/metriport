import { DocumentReference } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { createDocReferenceContent, getFHIRDocRef } from "../../../external/fhir/document";
import { metriportDataSourceExtension } from "../../../external/fhir/shared/extensions/metriport";
import { randomInt } from "../../../shared/numbers";
import { getPatientOrFail } from "../patient/get-patient";

const smallId = () => String(randomInt(3)).padStart(3, "0");

export type FileData = {
  mimetype?: string;
  size?: number;
  originalname: string;
  locationUrl: string;
  organizationName: string;
  practitionerName: string;
  fileDescription: string;
};

/**
 * ADMIN LOGIC - not to be used by other endpoints/services.
 *
 * This function is to be able to create a document reference
 * and upload it to the FHIR server with the purpose of testing.
 */
export async function createAndUploadDocReference({
  cxId,
  patientId,
  docId,
  fileData,
}: {
  cxId: string;
  patientId: string;
  docId: string;
  fileData: FileData;
}): Promise<DocumentReference> {
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const fhirApi = makeFhirApi(cxId);
  const refDate = dayjs();
  const orgId = smallId();
  const orgRef = `org${orgId}`;
  const practitionerId = smallId();
  const practitionerRef = `auth${practitionerId}`;

  const metriportContent = createDocReferenceContent({
    contentType: fileData.mimetype,
    size: fileData.size,
    creation: refDate.format(),
    fileName: fileData.originalname,
    location: fileData.locationUrl,
    extension: [metriportDataSourceExtension],
    format: "urn:ihe:pcc:xphr:2007",
  });

  const data: DocumentReference = getFHIRDocRef(patient.id, {
    id: docId,
    contained: [
      {
        resourceType: "Organization",
        id: orgRef,
        name: fileData.organizationName,
      },
      {
        resourceType: "Practitioner",
        id: practitionerRef,
        name: [
          {
            family: `Last ${practitionerId}`,
            given: [`First ${practitionerId}`],
            text: fileData.practitionerName,
          },
        ],
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
    date: refDate.toISOString(),
    status: "current",
    type: {
      coding: [
        {
          system: "http://loinc.org/",
          code: "75622-1",
          display: fileData.fileDescription,
        },
      ],
    },
    author: [
      {
        reference: `#${orgRef}`,
        type: "Organization",
      },
    ],
    extension: [metriportDataSourceExtension],
    description: fileData.fileDescription,
    content: [metriportContent],
    context: {
      period: {
        start: refDate.subtract(1, "hour").toISOString(),
        end: refDate.toISOString(),
      },
      sourcePatientInfo: {
        reference: `Patient/${patient.id}`,
        type: "Patient",
      },
    },
  });

  await fhirApi.updateResource(data);

  return data;
}
