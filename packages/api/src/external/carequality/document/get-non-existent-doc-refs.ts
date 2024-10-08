import { createDocumentFilePath } from "@metriport/core/domain/document/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReferenceWithMetriportId } from "../../../external/carequality/document/shared";
import { Config } from "../../../shared/config";
import { getDocumentsFromFHIR } from "../../fhir/document/get-documents";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const s3BucketName = Config.getMedicalDocumentsBucketName();
const parallelS3Queries = 10;

export async function getNonExistentDocRefs(
  documents: DocumentReferenceWithMetriportId[],
  patientId: string,
  cxId: string
): Promise<DocumentReferenceWithMetriportId[]> {
  const [{ existingDocRefs, nonExistingDocRefs }, fhirDocRefs] = await Promise.all([
    checkDocRefsExistInS3(documents, patientId, cxId),
    getDocumentsFromFHIR({ cxId, patientId }),
  ]);

  console.log("TEMP #2349 - existingDocRefs", existingDocRefs, existingDocRefs.length);
  console.log("TEMP #2349 - nonExistingDocRefs", nonExistingDocRefs, nonExistingDocRefs.length);

  const foundOnStorageButNotOnFHIR = existingDocRefs.filter(
    f => !fhirDocRefs.find(d => d.id === f.metriportId)
  );

  console.log(
    "TEMP #2349 - foundOnStorageButNotOnFHIR",
    foundOnStorageButNotOnFHIR,
    foundOnStorageButNotOnFHIR.length
  );

  const docsToDownload = nonExistingDocRefs.concat(foundOnStorageButNotOnFHIR);

  console.log("TEMP #2349 - docsToDownload", docsToDownload, docsToDownload.length);

  return docsToDownload;
}

type ObservedDocRefs = {
  existingDocRefs: DocumentReferenceWithMetriportId[];
  nonExistingDocRefs: DocumentReferenceWithMetriportId[];
};

async function checkDocRefsExistInS3(
  documents: DocumentReferenceWithMetriportId[],
  patientId: string,
  cxId: string
): Promise<ObservedDocRefs> {
  const { log } = out(`CQ checkDocRefsExistInS3 - patient ${patientId}`);
  const successfulDocs: { docId: string; exists: boolean }[] = [];

  await executeAsynchronously(
    documents,
    async doc => {
      try {
        const fileName = createDocumentFilePath(
          cxId,
          patientId,
          doc.metriportId,
          doc.contentType || undefined
        );

        const { exists } = await s3Utils.getFileInfoFromS3(fileName, s3BucketName);

        successfulDocs.push({
          docId: doc.metriportId,
          exists,
        });
      } catch (error) {
        const msg = `Failed to check if document exists in S3`;
        log(`${msg}: ${errorToString(error)}`);
        capture.message(msg, {
          extra: {
            context: `cq.checkDocRefsExistInS3`,
            error,
            doc,
            patientId,
            cxId,
          },
        });
        throw error;
      }
    },
    { numberOfParallelExecutions: parallelS3Queries }
  );

  const observedDocRefs: ObservedDocRefs = {
    existingDocRefs: [],
    nonExistingDocRefs: [],
  };

  for (const doc of documents) {
    const matchingDoc = successfulDocs.find(succDoc => succDoc.docId === doc.metriportId);

    if (matchingDoc && matchingDoc.exists) {
      observedDocRefs.existingDocRefs.push(doc);
    } else {
      observedDocRefs.nonExistingDocRefs.push(doc);
    }
  }

  return observedDocRefs;
}
