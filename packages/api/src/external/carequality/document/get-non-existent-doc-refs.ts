import { createDocumentFilePath } from "@metriport/core/domain/document/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { DocumentReferenceWithId } from "@metriport/core/external/fhir/document/document-reference";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { isMimeTypeXML } from "@metriport/core/util/mime";
import { capture } from "@metriport/core/util/notifications";
import { uniqBy } from "lodash";
import { DocumentReferenceWithMetriportId } from "../../../external/carequality/document/shared";
import { Config } from "../../../shared/config";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const s3BucketName = Config.getMedicalDocumentsBucketName();
const parallelS3Queries = 10;

export async function getNonExistentDocRefs(
  documents: DocumentReferenceWithMetriportId[],
  patientId: string,
  cxId: string,
  fhirDocRefs: DocumentReferenceWithId[],
  forceDownload: boolean | undefined
): Promise<DocumentReferenceWithMetriportId[]> {
  const { existingDocRefs, nonExistingDocRefs } = await checkDocRefsExistInS3(
    documents,
    patientId,
    cxId
  );

  const foundOnStorageButNotOnFHIR = existingDocRefs.filter(
    f => !fhirDocRefs.find(d => d.id === f.metriportId)
  );

  let docsToDownload = nonExistingDocRefs.concat(foundOnStorageButNotOnFHIR);

  if (forceDownload) {
    const { log } = out(`CQ getNonExistentDocRefs - patient ${patientId}`);
    log(
      `Force redownload is enabled for CX. There's currently ${docsToDownload.length} documents to download`
    );
    const isEligibleForRedownload = existingDocRefs.filter(d => isMimeTypeXML(d.contentType ?? ""));
    log(`Found ${isEligibleForRedownload.length} XMLs that we're gonna redownload.`);

    docsToDownload.push(...isEligibleForRedownload);
    docsToDownload = uniqBy(docsToDownload, d => d.metriportId);
    log(`Including redownload, there's now ${docsToDownload.length} documents to download`);
  }
  return docsToDownload;
}

type ObservedDocRefs = {
  existingDocRefs: DocumentReferenceWithMetriportId[];
  nonExistingDocRefs: DocumentReferenceWithMetriportId[];
};

async function checkDocRefsExistInS3(
  docsFound: DocumentReferenceWithMetriportId[],
  patientId: string,
  cxId: string
): Promise<ObservedDocRefs> {
  const { log } = out(`CQ checkDocRefsExistInS3 - patient ${patientId}`);
  const existingDocs: { docId: string; exists: boolean }[] = [];

  await executeAsynchronously(
    docsFound,
    async doc => {
      try {
        const fileName = createDocumentFilePath(
          cxId,
          patientId,
          doc.metriportId,
          doc.contentType || undefined
        );

        const { exists } = await s3Utils.getFileInfoFromS3(fileName, s3BucketName);

        existingDocs.push({
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

  for (const doc of docsFound) {
    const matchingDoc = existingDocs.find(existingDoc => existingDoc.docId === doc.metriportId);

    if (matchingDoc && matchingDoc.exists) {
      observedDocRefs.existingDocRefs.push(doc);
    } else {
      observedDocRefs.nonExistingDocRefs.push(doc);
    }
  }

  return observedDocRefs;
}
