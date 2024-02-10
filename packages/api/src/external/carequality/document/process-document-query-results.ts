import { DocumentReference as FHIRDocumentReference } from "@medplum/fhirtypes";
import { createDocumentFilePath } from "@metriport/core/domain/document/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { MedicalDataSource } from "@metriport/core/external/index";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference } from "@metriport/ihe-gateway-sdk";
import { Config } from "../../../shared/config";
import { isConvertible } from "../../fhir-converter/converter";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { getAllPages } from "../../fhir/shared/paginated";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { DocumentQueryResult } from "../document-query-result";

const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const s3BucketName = Config.getMedicalDocumentsBucketName();

export async function processDocumentQueryResults({
  requestId,
  patientId,
  cxId,
  documentQueryResults,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  documentQueryResults: DocumentQueryResult[];
}): Promise<void> {
  const { log } = out(`CQ query docs - requestId ${requestId}, M patient ${patientId}`);

  const docRefs = combineDocRefs(documentQueryResults);

  try {
    const docsToDownload = await getNonExistentDocRefs(docRefs, patientId, cxId);

    const convertibleDocCount = docsToDownload.filter(doc =>
      isConvertible(doc.contentType || undefined)
    ).length;

    log(`I have ${docsToDownload.length} docs to download (${convertibleDocCount} convertible)`);

    await setDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: {
        status: "processing",
        total: docsToDownload.length,
      },
      convertProgress: {
        status: "processing",
        total: convertibleDocCount,
      },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    // TODO - INTRODUCED WHEN IMPLEMENTING CQ DOC RETRIEVAL
    // NOTE MAKE SURE TO ADD DOC REFS TO TABLE WITH REQUESTID
    // downloadDocs(docsToDownload, patientId, cxId, requestId);
  } catch (error) {
    const msg = `Failed to process documents in Carequality.`;
    console.log(`${msg}. Error: ${errorToString(error)}`);

    await setDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    capture.message(msg, {
      extra: {
        context: `cq.processingDocuments`,
        error,
        patientId: patientId,
        requestId,
        cxId,
      },
      level: "error",
    });
    throw error;
  }
}

function combineDocRefs(documentQueryResults: DocumentQueryResult[]): DocumentReference[] {
  return documentQueryResults.reduce((acc: DocumentReference[], curr) => {
    const documentReferences = curr.data.documentReference ?? [];

    return [...acc, ...documentReferences];
  }, []);
}

const getNonExistentDocRefs = async (
  documents: DocumentReference[],
  patientId: string,
  cxId: string
): Promise<DocumentReference[]> => {
  const [{ existingDocRefs, nonExistingDocRefs }, FHIRDocRefs] = await Promise.all([
    filterOutExistingDocRefsS3(documents, patientId, cxId),
    getDocRefsFromFHIR(cxId, patientId),
  ]);

  const fhirDocRefIds = new Set(FHIRDocRefs.map(d => d.id));

  const foundOnStorageButNotOnFHIR = existingDocRefs.filter(f => !fhirDocRefIds.has(f.docUniqueId));

  const docsToDownload = nonExistingDocRefs.concat(foundOnStorageButNotOnFHIR);

  return docsToDownload;
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
  const docIdWithExist = await Promise.allSettled(
    documents.map(async (doc): Promise<{ docId: string; exists: boolean }> => {
      const fileName = createDocumentFilePath(
        cxId,
        patientId,
        doc.docUniqueId,
        doc.contentType ?? undefined
      );

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
