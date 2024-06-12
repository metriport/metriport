import { cqExtension } from "@metriport/core/external/carequality/extension";
import { OutboundDocQueryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { MedicalDataSource } from "@metriport/core/external/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference, OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { mapDocRefToMetriport } from "../../../shared/external";
import { isCQDirectEnabledForCx } from "../../aws/app-config";
import { isConvertible } from "../../fhir-converter/converter";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { makeIheGatewayAPIForDocRetrieval } from "../../ihe-gateway/api";
import { makeOutboundResultPoller } from "../../ihe-gateway/outbound-result-poller-factory";
import { getCQDirectoryEntry } from "../command/cq-directory/get-cq-directory-entry";
import { getCqInitiator } from "../shared";
import { createOutboundDocumentRetrievalReqs } from "./create-outbound-document-retrieval-req";
import { getNonExistentDocRefs } from "./get-non-existent-doc-refs";
import { getCQData } from "../patient";
import {
  cqToFHIR,
  DocumentReferenceWithMetriportId,
  filterDocRefsWithMetriportId,
  getContentTypeOrUnknown,
} from "./shared";
import { getDocumentReferenceContentTypeCounts } from "../../hie/get-docr-content-type-counts";
import { makeIHEGatewayV2 } from "../../ihe-gateway-v2/ihe-gateway-v2-factory";
import {
  getOrgOidsWithIHEGatewayV2Enabled,
  isIHEGatewayV2EnabledForCx,
} from "../../aws/app-config";

const parallelUpsertsToFhir = 10;
const iheGateway = makeIheGatewayAPIForDocRetrieval();
const resultPoller = makeOutboundResultPoller();

export async function processOutboundDocumentQueryResps({
  requestId,
  patientId,
  cxId,
  response,
}: OutboundDocQueryRespParam): Promise<void> {
  const { log } = out(`CQ DR - requestId ${requestId}, patient ${patientId}`);

  const interrupt = buildInterrupt({ requestId, patientId, cxId, log });
  if (!iheGateway) return interrupt(`IHE GW not available`);
  if (!resultPoller.isDREnabled()) return interrupt(`IHE DR result poller not available`);
  if (!(await isCQDirectEnabledForCx(cxId))) return interrupt(`CQ disabled for cx ${cxId}`);

  try {
    const patient = await getPatientOrFail({ id: patientId, cxId: cxId });
    const cqData = getCQData(patient.data.externalData);
    const docQueryStartedAt = cqData?.documentQueryProgress?.startedAt;
    const duration = elapsedTimeFromNow(docQueryStartedAt);
    const docRefs = response.flatMap(result => result.documentReference ?? []);
    const contentTypes = docRefs.map(getContentTypeOrUnknown);
    const contentTypeCounts = getDocumentReferenceContentTypeCounts(contentTypes);

    analytics({
      distinctId: cxId,
      event: EventTypes.documentQuery,
      properties: {
        requestId,
        patientId,
        hie: MedicalDataSource.CAREQUALITY,
        duration,
        documentCount: docRefs.length,
        ...contentTypeCounts,
      },
    });

    const responseWithDocsToDownload = await getRespWithDocsToDownload({
      cxId,
      patientId,
      requestId,
      response,
    });

    const docsToDownload = responseWithDocsToDownload.flatMap(
      result => result.documentReference ?? []
    );

    const convertibleDocCount = docsToDownload.filter(doc =>
      isConvertible(doc.contentType || undefined)
    ).length;

    log(`I have ${docsToDownload.length} docs to download (${convertibleDocCount} convertible)`);

    if (docsToDownload.length === 0) {
      log(`No new documents to download.`);

      await setDocQueryProgress({
        patient: { id: patientId, cxId: cxId },
        downloadProgress: { status: "completed" },
        convertProgress: { status: "completed" },
        requestId,
        source: MedicalDataSource.CAREQUALITY,
      });

      return;
    }

    await setDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: {
        status: "processing",
        total: docsToDownload.length,
      },
      ...(convertibleDocCount > 0
        ? {
            convertProgress: {
              status: "processing",
              total: convertibleDocCount,
            },
          }
        : {
            convertProgress: {
              status: "completed",
              total: 0,
            },
          }),
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    // Since we have most of the document contents when doing the document query,
    // we will store this in FHIR and then upsert the reference to the s3 object in FHIR
    // when doing the doc retrieval
    const docRefsWithMetriportId = filterDocRefsWithMetriportId(docsToDownload);
    await storeInitDocRefInFHIR(docRefsWithMetriportId, cxId, patientId, log);

    const resultsWithMetriportIdAndDrUrl = await replaceDqUrlWithDrUrl({
      patientId,
      requestId,
      cxId,
      resultsWithMetriportId: responseWithDocsToDownload,
      log,
    });

    const outboundDocumentQueryResultsV1: OutboundDocumentQueryResp[] = [];
    const outboundDocumentQueryResultsV2: OutboundDocumentQueryResp[] = [];

    const v2GatewayOIDs = await getOrgOidsWithIHEGatewayV2Enabled();
    const isV2EnabledForCx = await isIHEGatewayV2EnabledForCx(cxId);

    for (const result of resultsWithMetriportIdAndDrUrl) {
      if (isV2EnabledForCx || v2GatewayOIDs.includes(result.gateway.homeCommunityId)) {
        outboundDocumentQueryResultsV2.push(result);
      } else {
        outboundDocumentQueryResultsV1.push(result);
      }
    }

    const initiator = await getCqInitiator(patient);

    const documentRetrievalRequestsV1 = createOutboundDocumentRetrievalReqs({
      requestId,
      patient,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResultsV1,
    });

    const documentRetrievalRequestsV2 = createOutboundDocumentRetrievalReqs({
      requestId,
      patient,
      initiator,
      outboundDocumentQueryResults: outboundDocumentQueryResultsV2,
    });

    // We send the request to IHE Gateway to initiate the doc retrieval with doc references by each respective gateway.
    log(`Starting document retrieval, ${docsToDownload.length} docs to download`);

    if (documentRetrievalRequestsV1.length > 0) {
      log(`Starting document retrieval - Gateway V1`);
      await iheGateway.startDocumentsRetrieval({
        outboundDocumentRetrievalReq: documentRetrievalRequestsV1,
      });
    }

    if (documentRetrievalRequestsV2.length > 0) {
      log(`Starting document retrieval - Gateway V2`);
      const iheGatewayV2 = makeIHEGatewayV2();
      await iheGatewayV2.startDocumentRetrievalGatewayV2({
        drRequestsGatewayV2: documentRetrievalRequestsV2,
        requestId,
        patientId,
        cxId,
      });
    }

    await resultPoller.pollOutboundDocRetrievalResults({
      requestId,
      patientId: patientId,
      cxId: cxId,
      numOfGateways: documentRetrievalRequestsV1.length + documentRetrievalRequestsV2.length,
    });
  } catch (error) {
    const msg = `Failed to process documents in Carequality.`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await setDocQueryProgress({
      patient: { id: patientId, cxId: cxId },
      downloadProgress: { status: "failed" },
      convertProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    capture.message(msg, {
      extra: {
        context: `cq.processOutboundDocumentQueryResps`,
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
      convertProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });
  };
}

async function getRespWithDocsToDownload({
  cxId,
  patientId,
  requestId,
  response,
}: OutboundDocQueryRespParam): Promise<OutboundDocumentQueryResp[]> {
  const respWithDocsToDownload: OutboundDocumentQueryResp[] = [];

  await executeAsynchronously(
    response,
    async gwResp => {
      const resultsWithMetriportId = await updateDocumentReferencesWithMetriportId({
        cxId,
        patientId,
        requestId,
        response: gwResp,
      });
      const docRefs = resultsWithMetriportId.flatMap(result => result.documentReference ?? []);
      const docRefsWithMetriportId = filterDocRefsWithMetriportId(docRefs);
      const docsToDownload = await getNonExistentDocRefs(docRefsWithMetriportId, patientId, cxId);

      if (docsToDownload.length === 0) {
        return;
      }

      respWithDocsToDownload.push({
        ...gwResp,
        documentReference: docsToDownload,
      });
    },
    {
      numberOfParallelExecutions: 20,
    }
  );

  return respWithDocsToDownload;
}

async function updateDocumentReferencesWithMetriportId({
  cxId,
  patientId,
  requestId,
  response,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  response: OutboundDocumentQueryResp;
}): Promise<OutboundDocumentQueryResp[]> {
  const resultsWithMetriportId: OutboundDocumentQueryResp[] = [];

  const docRefs = response.documentReference ?? [];

  const docRefsWithMetriportId = await Promise.all(
    docRefs.map(docRef =>
      addMetriportDocRefID({
        cxId,
        patientId,
        requestId,
        document: docRef,
      })
    )
  );

  resultsWithMetriportId.push({
    ...response,
    documentReference: docRefsWithMetriportId,
  });

  return resultsWithMetriportId;
}

async function addMetriportDocRefID({
  cxId,
  patientId,
  requestId,
  document,
}: {
  patientId: string;
  cxId: string;
  requestId: string;
  document: DocumentReference;
}) {
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
}

async function replaceDqUrlWithDrUrl({
  patientId,
  requestId,
  cxId,
  resultsWithMetriportId,
  log,
}: {
  patientId: string;
  requestId: string;
  cxId: string;
  resultsWithMetriportId: OutboundDocumentQueryResp[];
  log: typeof console.log;
}): Promise<OutboundDocumentQueryResp[]> {
  const resultsWithMetriportIdAndDrUrl: OutboundDocumentQueryResp[] = [];

  await executeAsynchronously(
    resultsWithMetriportId,
    async outboundDocumentQueryResp => {
      const gateway = await getCQDirectoryEntry(outboundDocumentQueryResp.gateway.homeCommunityId);

      if (!gateway) {
        const msg = `Gateway not found - Doc Retrieval`;
        log(`${msg}: ${outboundDocumentQueryResp.gateway.homeCommunityId} skipping...`);
        capture.message(msg, {
          extra: {
            context: `cq.dq.getCQDirectoryEntry`,
            patientId,
            requestId,
            cxId,
            gateway: outboundDocumentQueryResp.gateway,
          },
        });
        return;
      } else if (!gateway.urlDR) {
        log(`Gateway ${gateway.id} has no DR URL, skipping...`);
        return;
      }

      resultsWithMetriportIdAndDrUrl.push({
        ...outboundDocumentQueryResp,
        gateway: {
          ...outboundDocumentQueryResp.gateway,
          url: gateway.urlDR,
        },
      });
    },
    {
      numberOfParallelExecutions: 20,
    }
  );

  return resultsWithMetriportIdAndDrUrl;
}

async function storeInitDocRefInFHIR(
  docRefs: DocumentReferenceWithMetriportId[],
  cxId: string,
  patientId: string,
  log: typeof console.log
) {
  await executeAsynchronously(
    docRefs,
    async docRef => {
      try {
        const docId = docRef.metriportId ?? "";

        const fhirDocRef = cqToFHIR(docId, docRef, "preliminary", patientId, cqExtension);

        await upsertDocumentToFHIRServer(cxId, fhirDocRef, log);
      } catch (error) {
        const msg = `Failed to store initial doc ref in FHIR`;
        log(`${msg}: ${errorToString(error)}`);
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
