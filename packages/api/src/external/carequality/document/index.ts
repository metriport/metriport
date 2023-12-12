import { DocumentQueryResponse, DocumentReference } from "@metriport/ihe-gateway-sdk";
import { DocumentReference as FHIRDocumentReference } from "@medplum/fhirtypes";
import { S3Utils, createS3FileName } from "@metriport/core/external/aws/s3";
import { Config } from "../../../shared/config";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { getAllPages } from "../../fhir/shared/paginated";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3BucketName = Config.getMedicalDocumentsBucketName();

export async function handleDocQueryResponse(
  docQueryResponse: DocumentQueryResponse
): Promise<void> {
  // Only download files that are not stored
  // I cant tell before hand if something is convertible or not here
  // That will need to be done by the lambda listening to docs being uploaded
  // We need to take into account the count
  // Check if we have the docs
  // If we dont trigger cq doc retrieval

  const { documentReference, patientId, cxId } = docQueryResponse;

  if (documentReference && documentReference.length) {
    const docsToDownload = getNonExistentDocRefs(documentReference, patientId, cxId);
  }
}

// AFAIK wont be able to know if its convertible until downloaded
// Also marking it as complete will need to change as well

// idea 1
// is when cq starts just add the counts on top of whats already there

// CW
// Get the doc refs
// we check which ones we have downloaded
// We set the count for amount to download as well as xml to convert
// When downloading is complete we mark the download status as complete and send a webhook to cx
// In the background docs are converted and stored in fhir and each time the ticker ups the successfully counted
// until they are all converted at which point we sent that it is completed

// if found on storage but no on fhir we want to download those as well

const getNonExistentDocRefs = async (
  documents: DocumentReference[],
  patientId: string,
  cxId: string
) => {
  const [existentialDocRefs, FHIRDocRefs] = await Promise.all([
    filterOutExistingDocRefsS3(documents, patientId, cxId),
    getDocRefsFromFHIR(cxId, patientId),
  ]);
};

type ExistentialDocRefs = {
  existingDocRefs: DocumentReference[];
  nonExistingDocRefs: DocumentReference[];
};

const filterOutExistingDocRefsS3 = async (
  documents: DocumentReference[],
  patientId: string,
  cxId: string
): Promise<ExistentialDocRefs> => {
  // TODO: TRY CATCH AND HANDLE ERR
  const docIdWithExist = await Promise.allSettled(
    documents.map(async (doc): Promise<{ docId: string; exists: boolean }> => {
      const fileName = createS3FileName(cxId, patientId, doc.docUniqueId);

      const { exists } = await s3Utils.getFileInfoFromS3(fileName, s3BucketName);

      return {
        docId: doc.docUniqueId,
        exists,
      };
    })
  );

  const successfulDocs = docIdWithExist.flatMap(ref =>
    ref.status === "fulfilled" && ref.value ? ref.value : []
  );

  const existentialDocRefs = documents.reduce(
    (acc: ExistentialDocRefs, curr) => {
      for (const succDoc of successfulDocs) {
        if (succDoc.docId === curr.docUniqueId) {
          if (succDoc.exists) {
            acc.existingDocRefs = [...acc.existingDocRefs, curr];
          } else {
            acc.nonExistingDocRefs = [...acc.nonExistingDocRefs, curr];
          }
        }
      }
      return acc;
    },
    {
      existingDocRefs: [],
      nonExistingDocRefs: [],
    }
  );

  return existentialDocRefs;
};

const getDocRefsFromFHIR = (cxId: string, patientId: string): Promise<FHIRDocumentReference[]> => {
  const fhirApi = makeFhirApi(cxId);

  return getAllPages(() =>
    fhirApi.searchResourcePages("DocumentReference", `patient=${patientId}`)
  );
};
