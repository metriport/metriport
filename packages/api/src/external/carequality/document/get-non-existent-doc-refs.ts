import { createDocumentFilePath } from "@metriport/core/domain/document/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { DocumentReferenceWithId } from "@metriport/core/external/fhir/document/document-reference";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { isMimeTypeXML } from "@metriport/core/util/mime";
import { capture } from "@metriport/core/util/notifications";
import { buildDayjs } from "@metriport/shared/common/date";
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

  const docsToDownload = nonExistingDocRefs.concat(foundOnStorageButNotOnFHIR);

  if (!forceDownload) return docsToDownload;

  const { log } = out(`CQ getNonExistentDocRefs, cx: ${cxId}, pt: ${patientId}`);
  log(`There's currently ${docsToDownload.length} documents to download`);

  const eligibleDocsForRedownload = existingDocRefs.filter(
    d => isMimeTypeXML(d.contentType ?? "") && isEligibleForRedownload(d.creation)
  );
  log(`Found ${eligibleDocsForRedownload.length} XMLs that we're gonna redownload`);

  const docsToDownloadWithRedownload = docsToDownload.concat(eligibleDocsForRedownload);
  const docsToDownloadUniq = uniqBy(docsToDownloadWithRedownload, d => d.metriportId);
  log(
    `Including redownload, there's now ${
      docsToDownloadUniq.length
    } documents to download: ${docsToDownloadUniq.map(d => d.metriportId).join(", ")}`
  );

  return docsToDownloadUniq;
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
  const existingDocs: { docId: string; exists: boolean }[] = [];

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

  for (const doc of documents) {
    const matchingDoc = existingDocs.find(existingDoc => existingDoc.docId === doc.metriportId);

    if (matchingDoc && matchingDoc.exists) {
      observedDocRefs.existingDocRefs.push(doc);
    } else {
      observedDocRefs.nonExistingDocRefs.push(doc);
    }
  }

  return observedDocRefs;
}

/**
 * Since not all documents have a creation date, we return true if the document
 * has no creation date or if the creation date is within the last year.
 */
function isEligibleForRedownload(creation: string | null | undefined): boolean {
  if (!creation) return true;

  const creationDate = buildDayjs(creation);
  const oneYearAgo = buildDayjs().subtract(1, "year");

  return creationDate.isAfter(oneYearAgo);
}
