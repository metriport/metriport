import { S3Utils } from "@metriport/core/external/aws/s3";
import { createFileName } from "@metriport/core/src/domain/filename";
import { Config } from "../../../shared/config";
import { DocumentWithMetriportId } from "../../../external/carequality/document/shared";
import { getDocuments } from "../../fhir/document/get-documents";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const s3BucketName = Config.getMedicalDocumentsBucketName();

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
  const docIdWithExist = await Promise.allSettled(
    documents.map(async (doc): Promise<{ docId: string; exists: boolean }> => {
      const fileName = createFileName(cxId, patientId, doc.docUniqueId);

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
    (acc: ObservedDocRefs, curr) => {
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
