import { S3Utils, createS3FileName } from "@metriport/core/external/aws/s3";
import { DocumentReference as FHIRDocumentReference } from "@medplum/fhirtypes";
import { Config } from "../../../shared/config";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { getAllPages } from "../../fhir/shared/paginated";
import { DocumentWithMetriportId } from "../../../external/carequality/document/shared";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const s3BucketName = Config.getMedicalDocumentsBucketName();

export const getNonExistentDocRefs = async (
  documents: DocumentWithMetriportId[],
  patientId: string,
  cxId: string
): Promise<DocumentWithMetriportId[]> => {
  const [{ existingDocRefs, nonExistingDocRefs }, FHIRDocRefs] = await Promise.all([
    filterOutExistingDocRefsS3(documents, patientId, cxId),
    getDocRefsFromFHIR(cxId, patientId),
  ]);

  const foundOnStorageButNotOnFHIR = existingDocRefs.filter(
    f => !FHIRDocRefs.find(d => d.id === f.docUniqueId)
  );

  const docsToDownload = nonExistingDocRefs.concat(foundOnStorageButNotOnFHIR);

  return docsToDownload;
};

type ExistentialDocRefs = {
  existingDocRefs: DocumentWithMetriportId[];
  nonExistingDocRefs: DocumentWithMetriportId[];
};

const filterOutExistingDocRefsS3 = async (
  documents: DocumentWithMetriportId[],
  patientId: string,
  cxId: string
): Promise<ExistentialDocRefs> => {
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
