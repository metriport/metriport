import { DocumentReference } from "@medplum/fhirtypes";
import { FileData } from "@metriport/core/external/aws/lambda-logic/document-uploader";
import { IETF_URL } from "@metriport/core/external/fhir/shared/namespaces";
import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { randomInt } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import { cloneDeep } from "lodash";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { createDocReferenceContent, getFHIRDocRef } from "../../../external/fhir/document";
import { metriportDataSourceExtension } from "../../../external/fhir/shared/extensions/metriport";
import { getPatientOrFail } from "../patient/get-patient";

const smallId = () => String(randomInt(3)).padStart(3, "0");

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
  file,
  location,
  metadata = {},
}: {
  cxId: string;
  patientId: string;
  docId: string;
  file: Express.Multer.File;
  location: string;
  metadata?: {
    description?: string;
    orgName?: string;
    practitionerName?: string;
  };
}): Promise<DocumentReference> {
  const patient = await getPatientOrFail({ id: patientId, cxId });

  const fhirApi = makeFhirApi(cxId);
  const refDate = dayjs();
  const orgId = smallId();
  const orgRef = `org${orgId}`;
  const practitionerId = smallId();
  const practitionerRef = `auth${practitionerId}`;

  const metriportContent = createDocReferenceContent({
    contentType: file.mimetype,
    size: file.size,
    creation: refDate.toISOString(),
    fileName: file.originalname,
    location,
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
        name: metadata.orgName ?? `Hospital ${orgRef}`,
      },
      {
        resourceType: "Practitioner",
        id: practitionerRef,
        name: [
          {
            family: `Last ${practitionerId}`,
            given: [`First ${practitionerId}`],
            text: metadata.practitionerName ?? undefined,
          },
        ],
      },
    ],
    masterIdentifier: {
      system: IETF_URL,
      value: docId,
    },
    identifier: [
      {
        use: "official",
        system: IETF_URL,
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

/**
 * Fetches a DocumentReference draft from the FHIR servers and updates its status and file content information.
 *
 * @param cxId The ID of the organization uploading a document
 * @param fileData The file metadata and DocumentReference ID
 */
export async function updateDocumentReference({
  cxId,
  fileData,
}: {
  cxId: string;
  fileData: FileData;
}): Promise<DocumentReference | undefined> {
  const fhirApi = makeFhirApi(cxId);
  try {
    const docRefDraft = await fhirApi.readResource("DocumentReference", fileData.docId);
    const updatedDocumentReference = amendDocumentReference(docRefDraft, fileData);
    console.log("Updated the DocRef:", JSON.stringify(updatedDocumentReference));

    const docRefFinal = await fhirApi.updateResource(updatedDocumentReference);
    return docRefFinal;
  } catch (error) {
    const msg = "Failed to update the document reference for a CX-uploaded file";
    console.log(`${msg} - error ${errorToString(error)}`);
    capture.error(msg, { extra: { context: `updateAndUploadDocumentReference`, cxId, error } });
    return undefined;
  }
}

function amendDocumentReference(doc: DocumentReference, fileData: FileData) {
  const refDate = dayjs();
  const amendedDocRef = cloneDeep(doc);
  const metriportContent = createDocReferenceContent({
    contentType: fileData.mimeType,
    size: fileData.size,
    creation: refDate.toISOString(),
    fileName: fileData.originalName,
    location: fileData.locationUrl,
    extension: [metriportDataSourceExtension],
  });

  amendedDocRef.extension = [metriportDataSourceExtension];
  amendedDocRef.content = [metriportContent];
  amendedDocRef.docStatus = "amended";

  return amendedDocRef;
}
