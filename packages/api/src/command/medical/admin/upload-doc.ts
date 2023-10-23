import { DocumentReference } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import dayjs from "dayjs";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { createDocReferenceContent } from "../../../external/fhir/document";
import { metriportDataSourceExtension } from "../../../external/fhir/shared/extensions/metriport";
import { capture } from "../../../shared/notifications";
// import { randomInt } from "../../../shared/numbers";

// const smallId = () => String(randomInt(3)).padStart(3, "0");

export type FileData = {
  mimetype?: string;
  size?: number;
  originalname: string;
  locationUrl: string;
  docRefId: string;
};

/**
 * ADMIN LOGIC - not to be used by other endpoints/services.
 *
 * This function is to be able to create a document reference
 * and upload it to the FHIR server with the purpose of testing.
 */
// export async function createAndUploadDocReference({
//   cxId,
//   patientId,
//   docId,
//   fileData,
// }: {
//   cxId: string;
//   patientId: string;
//   docId: string;
//   fileData: FileData;
// }): Promise<DocumentReference> {
//   const patient = await getPatientOrFail({ id: patientId, cxId });

//   const fhirApi = makeFhirApi(cxId);
//   const refDate = dayjs();
//   const orgId = smallId();
//   const orgRef = `org${orgId}`;
//   const practitionerId = smallId();
//   const practitionerRef = `auth${practitionerId}`;

//   const metriportContent = createDocReferenceContent({
//     contentType: fileData.mimetype,
//     size: fileData.size,
//     creation: refDate.format(),
//     fileName: fileData.originalname,
//     location: fileData.locationUrl,
//     extension: [metriportDataSourceExtension],
//     format: "urn:ihe:pcc:xphr:2007",
//   });

//   const data: DocumentReference = getFHIRDocRef(patient.id, {
//     id: docId,
//     contained: [
//       {
//         resourceType: "Organization",
//         id: orgRef,
//         name: fileData.organizationName,
//       },
//       {
//         resourceType: "Practitioner",
//         id: practitionerRef,
//         name: [
//           {
//             family: `Last ${practitionerId}`,
//             given: [`First ${practitionerId}`],
//             text: fileData.practitionerName,
//           },
//         ],
//       },
//     ],

//     masterIdentifier: {
//       system: "urn:ietf:rfc:3986",
//       value: docId,
//     },
//     identifier: [
//       {
//         use: "official",
//         system: "urn:ietf:rfc:3986",
//         value: docId,
//       },
//     ],
//     date: refDate.toISOString(),
//     status: "current",
//     type: {
//       coding: [
//         {
//           system: "http://loinc.org/",
//           code: "75622-1",
//           display: fileData.fileDescription,
//         },
//       ],
//     },
//     author: [
//       {
//         reference: `#${orgRef}`,
//         type: "Organization",
//       },
//     ],
//     extension: [metriportDataSourceExtension],
//     description: fileData.fileDescription,
//     content: [metriportContent],
//     context: {
//       period: {
//         start: refDate.subtract(1, "hour").toISOString(),
//         end: refDate.toISOString(),
//       },
//       sourcePatientInfo: {
//         reference: `Patient/${patient.id}`,
//         type: "Patient",
//       },
//     },
//   });

//   await fhirApi.updateResource(data);

//   return data;
// }

/**
 * Fetches a DocumentReference draft from the FHIR servers and updates its status and file content information.
 *
 * @param cxId The CX ID of the patient
 * @param patientId The patient ID
 * @param fileData The file metadata and DocumentReference ID
 */
export async function updateAndUploadDocumentReference({
  cxId,
  fileData,
}: {
  cxId: string;
  fileData: FileData;
}): Promise<void> {
  const fhirApi = makeFhirApi(cxId);
  try {
    const docRefDraft = await fhirApi.readResource("DocumentReference", fileData.docRefId);
    console.log("FETCHED THE DOC REF DRAFT IN POST PROCESSING", JSON.stringify(docRefDraft));

    const updatedDocumentReference = updateDocumentReference(docRefDraft, fileData);
    console.log("FINAlIZED DOCREF: ", JSON.stringify(updatedDocumentReference));

    await fhirApi.updateResource(updatedDocumentReference);
  } catch (error) {
    const message = "Failed to update the document reference for a CX-uploaded file";
    capture.error(message, { extra: { context: `updateAndUploadDocumentReference`, error, cxId } });
  }
}

function updateDocumentReference(doc: DocumentReference, fileData: FileData) {
  const refDate = dayjs();
  const docId = uuidv7();

  const metriportContent = createDocReferenceContent({
    contentType: fileData.mimetype,
    size: fileData.size,
    creation: refDate.format(),
    fileName: fileData.originalname,
    location: fileData.locationUrl,
    extension: [metriportDataSourceExtension],
  });

  const upd: DocumentReference = { ...doc, id: docId };
  upd.content = upd.content ? [...upd.content, metriportContent] : [metriportContent];
  upd.docStatus = "amended";
  return upd;
}
