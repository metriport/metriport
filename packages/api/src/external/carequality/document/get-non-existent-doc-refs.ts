import { S3Utils } from "@metriport/core/external/aws/s3";
import { createFileName } from "@metriport/core/src/domain/filename";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { Config } from "../../../shared/config";
import { DocumentWithMetriportId } from "../../../external/carequality/document/shared";
import { getDocuments } from "../../fhir/document/get-documents";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const s3BucketName = Config.getMedicalDocumentsBucketName();
const parallelS3Queries = 10;

export const getNonExistentDocRefs = async (
  documents: DocumentWithMetriportId[],
  patientId: string,
  cxId: string
): Promise<DocumentWithMetriportId[]> => {
  const [{ existingDocRefs, nonExistingDocRefs }, fhirDocRefs] = await Promise.all([
    filterOutExistingDocRefsS3(documents, patientId, cxId),
    getDocuments({ cxId, patientId }),
  ]);

  const foundOnStorageButNotOnFHIR = existingDocRefs.filter(
    f => !fhirDocRefs.find(d => d.id === f.docUniqueId)
  );

  const docsToDownload = nonExistingDocRefs.concat(foundOnStorageButNotOnFHIR);

  return docsToDownload;
};

type ObservedDocRefs = {
  existingDocRefs: DocumentWithMetriportId[];
  nonExistingDocRefs: DocumentWithMetriportId[];
};

const filterOutExistingDocRefsS3 = async (
  documents: DocumentWithMetriportId[],
  patientId: string,
  cxId: string
): Promise<ObservedDocRefs> => {
  const successfulDocs: { docId: string; exists: boolean }[] = [];

  await executeAsynchronously(documents, async doc => {
    try {
      const fileName = createFileName(cxId, patientId, doc.docUniqueId);

      const { exists } = await s3Utils.getFileInfoFromS3(fileName, s3BucketName);

      successfulDocs.push({
        docId: doc.docUniqueId,
        exists,
      });
    } catch (error) {
      const msg = `Failed to store initial doc ref in FHIR`;
      console.log(`${msg}: ${errorToString(error)}`);
      capture.message(msg, {
        extra: {
          context: `cq.storeInitDocRefInFHIR`,
          error,
          doc,
          patientId,
          cxId,
        },
      });
      throw error;
    }
  }, { numberOfParallelExecutions: parallelS3Queries });


  const observedDocRefs = documents.reduce(
    (acc: ObservedDocRefs, curr) => {
      const matchingDoc = successfulDocs.find(succDoc => succDoc.docId === curr.docUniqueId);

      if (matchingDoc && matchingDoc.exists) {
        acc.existingDocRefs = [...acc.existingDocRefs, curr];
      } else {
        acc.nonExistingDocRefs = [...acc.nonExistingDocRefs, curr];
      }

      return acc;
    },
    {
      existingDocRefs: [],
      nonExistingDocRefs: [],
    }
  );

  return observedDocRefs;
};
