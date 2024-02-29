import { MedicalDataSource } from "@metriport/core/external/index";
import { OutboundDocQueryRespPayload } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference, OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { mapDocRefToMetriport } from "../../../shared/external";
import { isCQDirectEnabledForCx } from "../../aws/appConfig";
import { cqExtension } from "../../carequality/extension";
import { isConvertible } from "../../fhir-converter/converter";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { makeIheGatewayAPIForDocRetrieval } from "../../ihe-gateway/api";
import { makeOutboundResultPoller } from "../../ihe-gateway/outbound-result-poller-factory";
import { getCQDirectoryEntryOrFail } from "../command/cq-directory/get-cq-directory-entry";
import { createOutboundDocumentRetrievalReqs } from "./create-outbound-document-retrieval-req";
import { getNonExistentDocRefs } from "./get-non-existent-doc-refs";
import { cqToFHIR, DocumentReferenceWithMetriportId, toDocumentReference } from "./shared";

const parallelUpsertsToFhir = 10;
const iheGateway = makeIheGatewayAPIForDocRetrieval();
const resultPoller = makeOutboundResultPoller();

export async function processOutboundDocumentQueryResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundDocQueryRespPayload): Promise<void> {
  const { log } = out(`CQ DR - requestId ${requestId}, patient ${patientId}`);

  const interrupt = buildInterrupt({ requestId, patientId, cxId, log });
  if (!iheGateway) return interrupt(`IHE GW not available`);
  if (!resultPoller.isDREnabled()) return interrupt(`IHE DR result poller not available`);
  if (!(await isCQDirectEnabledForCx(cxId))) return interrupt(`CQ disabled for cx ${cxId}`);

  try {
    const docRefs = results.flatMap(toDocumentReference);
    const docRefsWithMetriportId = await Promise.all(
      docRefs.map(addMetriportDocRefID({ cxId, patientId, requestId }))
    );

    const [docsToDownload, organization] = await Promise.all([
      getNonExistentDocRefs(docRefsWithMetriportId, patientId, cxId),
      getOrganizationOrFail({ cxId }),
    ]);

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

    const respWithDRUrl: OutboundDocumentQueryResp[] = [];

    const replaceDqUrlWithDrUrl = async (
      outboundDocumentQueryResp: OutboundDocumentQueryResp
    ): Promise<void> => {
      const gateway = await getCQDirectoryEntryOrFail(
        outboundDocumentQueryResp.gateway.homeCommunityId
      );

      if (!gateway.urlDR) {
        console.log(`Gateway ${gateway.id} has no DR URL, skipping...`);
        return;
      }
      respWithDRUrl.push({
        ...outboundDocumentQueryResp,
        gateway: {
          ...outboundDocumentQueryResp.gateway,
          url: gateway.urlDR,
        },
      });
    };

    await executeAsynchronously(results, replaceDqUrlWithDrUrl, {
      numberOfParallelExecutions: 20,
    });

    const documentRetrievalRequests = createOutboundDocumentRetrievalReqs({
      requestId,
      cxId,
      organization,
      documentReferences: docsToDownload,
      outboundDocumentQueryResps: respWithDRUrl,
    });

    // We send the request to IHE Gateway to initiate the doc retrieval with doc references by each respective gateway.
    log(`Starting document retrieval, ${docsToDownload.length} docs to download`);
    await iheGateway.startDocumentsRetrieval({
      outboundDocumentRetrievalReq: documentRetrievalRequests,
    });

    await resultPoller.pollOutboundDocRetrievalResults({
      requestId,
      patientId: patientId,
      cxId: cxId,
      numOfGateways: documentRetrievalRequests.length,
    });
  } catch (error) {
    const msg = `Failed to process documents in Carequality.`;
    log(`${msg}. Error: ${errorToString(error)}`);

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

function buildInterrupt({
  requestId,
  patientId,
  cxId,
  log,
}: {
  requestId: string;
  patientId: string;
  cxId: string;
  log: typeof console.log;
}) {
  return async (reason: string): Promise<void> => {
    // Error because it shouldn't try to DR if it can't execute, it should be interrupted at DQ
    const msg = "Programming error processing CQ Doc Retrieval";
    log(`${msg}: ${reason}; skipping DR`);
    capture.error(msg, {
      extra: { requestId, patientId, cxId, reason },
    });
    await setDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });
  };
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

        const fhirDocRef = cqToFHIR(docId, docRef, "preliminary", patientId, cqExtension);

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
      metriportId,
    };
  };
}
