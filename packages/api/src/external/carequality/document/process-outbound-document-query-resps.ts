import { out } from "@metriport/core/util/log";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { makeLambdaClient } from "@metriport/core/external/aws/lambda";
import { errorToString } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference, OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { isConvertible } from "../../fhir-converter/converter";
import { Config } from "../../../shared/config";
import { MedicalDataSource } from "@metriport/core/external/index";
import { mapDocRefToMetriport } from "../../../shared/external";
import { DocumentReferenceWithMetriportId } from "./shared";
import { getNonExistentDocRefs } from "./get-non-existent-doc-refs";
import { makeIheGatewayAPI } from "../api";
import { createOutboundDocumentRetrievalReqs } from "./create-outbound-document-retrieval-req";
import { getPatientWithDependencies } from "../../../command/medical/patient/get-patient";
import { toDocumentReference } from "./shared";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { cqToFHIR } from "./shared";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { processAsyncError } from "../../../errors";
import { cqExtension } from "../../carequality/extension";

const region = Config.getAWSRegion();
const iheGateway = makeIheGatewayAPI();
const lambdaClient = makeLambdaClient(region);
const lambdaName = Config.getOutboundDocRetrievalLambdaName();
const parallelUpsertsToFhir = 10;

export async function processOutboundDocumentQueryResps({
  requestId,
  patientId,
  cxId,
  outboundDocumentQueryResps,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  outboundDocumentQueryResps: OutboundDocumentQueryResp[];
}): Promise<void> {
  if (!iheGateway) return;
  const { log } = out(`CQ query docs - requestId ${requestId}, M patient ${patientId}`);

  const { organization } = await getPatientWithDependencies({ id: patientId, cxId });

  const docRefs = outboundDocumentQueryResps.flatMap(toDocumentReference);

  const docRefsWithMetriportId = await Promise.all(
    docRefs.map(addMetriportDocRefID({ cxId, patientId, requestId }))
  );

  try {
    const docsToDownload = await getNonExistentDocRefs(docRefsWithMetriportId, patientId, cxId);

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

    // Since we have most of the document contents when doing the document query,
    // we will store this in FHIR and then upsert the reference to the s3 object in FHIR
    // when doing the doc retrieval
    await storeInitDocRefInFHIR(docRefsWithMetriportId, cxId, patientId);

    const documentRetrievalRequests = createOutboundDocumentRetrievalReqs({
      requestId,
      cxId,
      organization,
      documentReferences: docsToDownload,
      outboundDocumentQueryResps,
    });

    // We send the request to IHE Gateway to initiate the doc retrieval with doc references by each respective gateway.
    await iheGateway.startDocumentsRetrieval({
      outboundDocumentRetrievalReq: documentRetrievalRequests,
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
      .promise()
      .catch(
        processAsyncError("Failed to invoke lambda to start polling for doc retrieval results")
      );
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

async function storeInitDocRefInFHIR(
  docRefs: DocumentReferenceWithMetriportId[],
  cxId: string,
  patientId: string
) {
  await executeAsynchronously(
    docRefs,
    async docRef => {
      try {
        const docId = docRef.metriportId ?? "";

        const fhirDocRef = cqToFHIR(docId, docRef, patientId, cqExtension);

        await upsertDocumentToFHIRServer(cxId, fhirDocRef);
      } catch (error) {
        const msg = `Failed to store initial doc ref in FHIR`;
        console.log(`${msg}: ${errorToString(error)}`);
        capture.message(msg, {
          extra: {
            context: `cq.storeInitDocRefInFHIR`,
            error,
            docRef,
            patientId,
            cxId,
          },
        });
        throw error;
      }
    },
    { numberOfParallelExecutions: parallelUpsertsToFhir }
  );
}

function addMetriportDocRefID({
  cxId,
  patientId,
  requestId,
}: {
  patientId: string;
  cxId: string;
  requestId: string;
}) {
  return async (document: DocumentReference): Promise<DocumentReferenceWithMetriportId> => {
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
      docUniqueId: originalId,
      id: metriportId,
    };
  };
}
