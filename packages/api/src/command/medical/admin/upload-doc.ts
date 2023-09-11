import { DocumentReference } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { createDocReferenceContent, getFHIRDocRef } from "../../../external/fhir/document";
import { metriportDataSourceExtension } from "../../../external/fhir/shared/extensions/metriport";
import { Config } from "../../../shared/config";
import { randomInt } from "../../../shared/numbers";
import { getPatientOrFail } from "../patient/get-patient";

const apiUrl = Config.getApiUrl();
const docContributionUrl = `${apiUrl}/doc-contribution/commonwell/`;

const smallId = () => String(randomInt(3)).padStart(3, "0");

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

  const fhirApi = makeFhirApi(cxId);
  const refDate = dayjs();
  const orgId = smallId();
  const orgRef = `org${orgId}`;
  const practitionerId = smallId();
  const practitionerRef = `org${practitionerId}`;

  const metriportContent = createDocReferenceContent({
    contentType: file.mimetype,
    size: file.size,
    creation: refDate.format(),
    fileName: file.originalname,
    location: `${docContributionUrl}?fileName=${file.originalname}`,
    extension: [metriportDataSourceExtension],
    format: "urn:ihe:pcc:xphr:2007",
  });

  // WHEN OPENING THIS FOR CX'S NEED TO UPDATE THE CONTENT
  const data: DocumentReference = getFHIRDocRef(patient.id, {
    id: docId,
    contained: [
      {
        resourceType: "Organization",
        id: orgRef,
        name: `Hospital ${orgRef}`,
      },
      {
        resourceType: "Practitioner",
        id: practitionerRef,
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
          display: metadata.description,
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
    description: metadata.description,
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
