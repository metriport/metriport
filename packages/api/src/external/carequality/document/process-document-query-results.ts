import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference } from "@metriport/ihe-gateway-sdk";
import { DocumentQueryResult } from "../domain/document-query-result";
import { isConvertible } from "../../fhir-converter/converter";
import { MedicalDataSource } from "../../../external";
import { appendDocQueryProgressWithSource } from "../../hie/append-doc-query-progress-with-source";
import { mapDocRefToMetriport } from "../../../shared/external";
import { DocumentWithMetriportId } from "../../../external/carequality/document/shared";
import { getNonExistentDocRefs } from "./get-non-existent-doc-refs";
import { makeIheGatewayAPI } from "../api";
import { createCQDocumentRetrievalRequests } from "./document-query-retrieval";

const iheGateway = makeIheGatewayAPI();

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
  if (!iheGateway) return;

  const { log } = out(`CQ query docs - requestId ${requestId}, M patient ${patientId}`);

  const docRefs = combineDocRefs(documentQueryResults);

  const docRefsWithMetriportId = await Promise.all(
    docRefs.map(addMetriportDocRef({ cxId, patientId, requestId }))
  );

  try {
    const docsToDownload = await getNonExistentDocRefs(docRefsWithMetriportId, patientId, cxId);

    const convertibleDocCount = docsToDownload.filter(doc =>
      isConvertible(doc.contentType || undefined)
    ).length;

    log(`I have ${docsToDownload.length} docs to download (${convertibleDocCount} convertible)`);

    await appendDocQueryProgressWithSource({
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

    const documentRetrievalRequests = createCQDocumentRetrievalRequests({
      requestId,
      cxId,
      documentReferences: docsToDownload,
    });

    await iheGateway.startDocumentsRetrieval({
      documentRetrievalRequestOutgoing: documentRetrievalRequests,
    });

    // TODO - INTRODUCED WHEN IMPLEMENTING CQ DOC RETRIEVAL

    // Download and store files in S3
    // Convert all XML files to FHIR
    // Store document references in FHIR

    // downloadDocs(docsToDownload, patientId, cxId, requestId);
  } catch (error) {
    const msg = `Failed to process documents in Carequality.`;
    console.log(`${msg}. Error: ${errorToString(error)}`);

    await appendDocQueryProgressWithSource({
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

// Create a single array of all the document references from all the document query results
function combineDocRefs(documentQueryResults: DocumentQueryResult[]): DocumentReference[] {
  return documentQueryResults.reduce((acc: DocumentReference[], curr) => {
    const documentReferences = curr.data.documentReference ?? [];

    return [...acc, ...documentReferences];
  }, []);
}

function addMetriportDocRef({
  cxId,
  patientId,
  requestId,
}: {
  patientId: string;
  cxId: string;
  requestId: string;
}) {
  return async (document: DocumentReference): Promise<DocumentWithMetriportId> => {
    const documentId = document.docUniqueId;

    const { metriportId, originalId } = await mapDocRefToMetriport({
      cxId,
      patientId,
      documentId,
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });
    return {
      ...document,
      originalId: originalId,
      id: metriportId,
    };
  };
}
