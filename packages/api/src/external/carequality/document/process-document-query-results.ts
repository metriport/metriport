import { out } from "@metriport/core/util/log";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { errorToString } from "@metriport/core/util/error/index";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference } from "@metriport/ihe-gateway-sdk";
import { DocumentQueryResult } from "../document-query-result";
import { isConvertible } from "../../fhir-converter/converter";
import { Config } from "../../../shared/config";
import { MedicalDataSource } from "../../../external";
import { appendDocQueryProgressWithSource } from "../../hie/append-doc-query-progress-with-source";
import { mapDocRefToMetriport } from "../../../shared/external";
import { DocumentWithMetriportId } from "../../../external/carequality/document/shared";
import { getNonExistentDocRefs } from "./get-non-existent-doc-refs";
import { makeIheGatewayAPI } from "../api";
import { createCQDocumentRetrievalRequests } from "./document-query-retrieval";
import { getPatientWithDependencies } from "../../../command/medical/patient/get-patient";
import { combineDocRefs } from "./shared";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { cqToFHIR } from "../../fhir/document";

const region = Config.getAWSRegion();
const iheGateway = makeIheGatewayAPI();
const lambdaClient = makeLambdaClient(region);
const lambdaName = Config.getDocQueryResultsLambdaName();

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

  const { organization } = await getPatientWithDependencies({ id: patientId, cxId });

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

    await storeInitDocRefInFHIR(docRefsWithMetriportId, cxId, patientId);

    const documentRetrievalRequests = createCQDocumentRetrievalRequests({
      requestId,
      cxId,
      organization,
      documentReferences: docsToDownload,
      documentQueryResults: documentQueryResults,
    });

    // We send the request to IHE Gateway to initiate the doc retrieval with doc references by each respective gateway.
    await iheGateway.startDocumentsRetrieval({
      documentRetrievalReqToExternalGW: documentRetrievalRequests,
    });

    // We invoke the lambda that will start polling for the results
    // from the IHE Gateway for document retrieval results and process them
    lambdaClient
      .invoke({
        FunctionName: lambdaName,
        InvocationType: "Event",
        Payload: JSON.stringify({
          requestId,
          patientId: patientId,
          cxId: cxId,
          numOfGateways: documentRetrievalRequests.length,
        }),
      })
      .promise();
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

// Since we have most of the document contents when doing the document query,
// we will store this in s3 and then upsert the reference to the s3 object in FHIR
// when doing the doc retrieval
async function storeInitDocRefInFHIR(
  docRefs: DocumentWithMetriportId[],
  cxId: string,
  patientId: string
) {
  await Promise.allSettled(
    docRefs.map(async docRef => {
      try {
        const docId = docRef.metriportId ?? "";

        const FHIRDocRef = cqToFHIR(docId, docRef, patientId);

        await upsertDocumentToFHIRServer(cxId, FHIRDocRef);
      } catch (error) {
        console.log(`Failed to store initial doc ref in FHIR: ${errorToString(error)}`);
        capture.error(error, {
          extra: {
            context: `cq.storeInitDocRefInFHIR`,
            error,
            docRef,
          },
        });
        throw error;
      }
    })
  );
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
