import { DocumentReference } from "@medplum/fhirtypes";
import { FileData } from "@metriport/core/external/aws/lambda-logic/document-uploader";
import dayjs from "dayjs";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { createDocReferenceContent } from "../../../external/fhir/document";
import { metriportDataSourceExtension } from "../../../external/fhir/shared/extensions/metriport";
import { capture } from "../../../shared/notifications";

/**
 * Fetches a DocumentReference draft from the FHIR servers and updates its status and file content information.
 *
 * @param cxId The CX ID of the patient
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
    const updatedDocumentReference = updateDocumentReference(docRefDraft, fileData);
    console.log("Updated the DocRef:", JSON.stringify(updatedDocumentReference));

    await fhirApi.updateResource(updatedDocumentReference);
    return;
  } catch (error) {
    const message = "Failed to update the document reference for a CX-uploaded file";
    capture.error(message, { extra: { context: `updateAndUploadDocumentReference`, error, cxId } });
  }
}

function updateDocumentReference(doc: DocumentReference, fileData: FileData) {
  const refDate = dayjs();

  const metriportContent = createDocReferenceContent({
    contentType: fileData.mimeType,
    size: fileData.size,
    creation: refDate.format(),
    fileName: fileData.originalName,
    location: fileData.locationUrl,
    extension: [metriportDataSourceExtension],
  });

  doc.extension = [metriportDataSourceExtension];
  doc.content = [metriportContent];
  doc.docStatus = "amended";

  return doc;
}
