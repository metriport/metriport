import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import pTimeout from "p-timeout";
import { DocumentReference as FHIRDocumentReference } from "@medplum/fhirtypes";
import { S3Utils, createS3FileName } from "@metriport/core/external/aws/s3";
import { errorToString } from "@metriport/core/util/error";
import { DocumentQueryResult } from "../domain/document-query-result";
import { DocumentReference } from "../domain/ihe-result";
import { Patient } from "../../../domain/medical/patient";
import { getDocumentQueryResult } from "../command/ihe-result/get-document-query-result";
import { Config } from "../../../shared/config";
import { makeFhirApi } from "../../fhir/api/api-factory";
import { getAllPages } from "../../fhir/shared/paginated";
import { isConvertible } from "../../fhir-converter/converter";
import { appendDocQueryProgress } from "../../../command/medical/patient/append-doc-query-progress";
import { createCQDocumentQueryRequest } from "./document-query-request";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { makeIheGatewayAPI } from "../api";
import { capture } from "../../../shared/notifications";
import { MedicalDataSource } from "../../../external";
import { getCQPatientData } from "../command/cq-patient-data/get-cq-data";
import { MAPIWebhookStatus } from "../../../command/medical/document/document-webhook";
import { processPatientDocumentRequest } from "../../../command/medical/document/document-webhook";
// import { downloadDocs } from "./download-documents";

const s3Utils = new S3Utils(Config.getAWSRegion());
const s3BucketName = Config.getMedicalDocumentsBucketName();
const iheGateway = makeIheGatewayAPI();

export const DOCUMENT_QUERY_TIMEOUT = dayjs.duration({ minutes: 2 });

export async function getDocumentsFromCQ({
  requestId,
  patient,
}: {
  requestId: string;
  patient: Patient;
}) {
  if (!iheGateway) return;

  const { log } = out(`CQ query docs - requestId ${requestId}, M patient ${"123"}`);

  try {
    const organization = await getOrganizationOrFail({ cxId: patient.cxId });
    const cqPatientData = await getCQPatientData({ id: patient.id, cxId: patient.cxId });

    const docQueryRequest = createCQDocumentQueryRequest({
      requestId,
      cxId: patient.cxId,
      organization,
      cqLinks: cqPatientData?.data.links ?? [],
    });

    await iheGateway.startDocumentsQuery(docQueryRequest);

    // TODO: CHANGE THIS TO THE STRATEGY RAMIL USED: RACE CONTROL
    const results = await pTimeout(
      getDocumentQueryResult({ requestId }),
      DOCUMENT_QUERY_TIMEOUT.asMilliseconds(),
      "handleDocQueryResponse function timed out!"
    );

    await handleDocQueryResults(requestId, patient.id, patient.cxId, results, log);
  } catch (error) {
    const msg = `Failed to query and process documents in Carequality.`;
    console.log(`${msg}. Error: ${errorToString(error)}`);

    const updatedPatient = await appendDocQueryProgress({
      patient: { id: patient.id, cxId: patient.cxId },
      downloadProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.COMMONWELL,
    });

    const downloadProgressHasFailed =
      updatedPatient.data.documentQueryProgress?.download?.status === "failed";

    if (downloadProgressHasFailed) {
      processPatientDocumentRequest(
        patient.cxId,
        patient.id,
        "medical.document-download",
        MAPIWebhookStatus.failed
      );
    }

    capture.message(msg, {
      extra: {
        context: `cq.queryAndProcessDocuments`,
        error,
        patientId: patient.id,
        requestId,
      },
      level: "error",
    });
    throw error;
  }
}

export async function handleDocQueryResults(
  requestId: string,
  patientId: string,
  cxId: string,
  docQueryResults: DocumentQueryResult[],
  log = console.log
): Promise<void> {
  const docRefs = combineDocRefs(docQueryResults);

  const docsToDownload = await getNonExistentDocRefs(docRefs, patientId, cxId);

  const convertibleDocCount = docsToDownload.filter(doc => isConvertible(doc.contentType)).length;

  log(`I have ${docsToDownload.length} docs to download (${convertibleDocCount} convertible)`);

  appendDocQueryProgress({
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
    source: MedicalDataSource.COMMONWELL,
  });

  // TODO - INTRODUCED WHEN IMPLEMENTING CQ DOC RETRIEVAL
  // downloadDocs(docsToDownload, patientId, cxId, requestId);
}

function combineDocRefs(docQueryResults: DocumentQueryResult[]): DocumentReference[] {
  return docQueryResults.reduce((acc: DocumentReference[], curr) => {
    return [...acc, ...curr.data.documentReference];
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

  const foundOnStorageButNotOnFHIR = existingDocRefs.filter(
    f => !FHIRDocRefs.find(d => d.id === f.docUniqueId)
  );

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
