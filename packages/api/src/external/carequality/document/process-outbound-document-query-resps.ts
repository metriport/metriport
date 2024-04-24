import { MedicalDataSource } from "@metriport/core/external/index";
import { OutboundDocQueryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { cqExtension } from "@metriport/core/external/carequality/extension";
import { errorToString } from "@metriport/core/util/error/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { DocumentReference, OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { mapDocRefToMetriport } from "../../../shared/external";
import { isCQDirectEnabledForCx } from "../../aws/appConfig";
import { isConvertible } from "../../fhir-converter/converter";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { makeIheGatewayAPIForDocRetrieval } from "../../ihe-gateway/api";
import { makeOutboundResultPoller } from "../../ihe-gateway/outbound-result-poller-factory";
import { getCQDirectoryEntry } from "../command/cq-directory/get-cq-directory-entry";
import { createOutboundDocumentRetrievalReqs } from "./create-outbound-document-retrieval-req";
import { getNonExistentDocRefs } from "./get-non-existent-doc-refs";
import { cqToFHIR, DocumentReferenceWithMetriportId, toDocumentReference } from "./shared";
import { analytics, EventTypes } from "../../../shared/analytics";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { makeIHEGatewayV2 } from "../../ihe-gateway-v2/ihe-gateway-v2-factory";
import { getOidsWithIHEGatewayV2Enabled } from "../../aws/appConfig";

const parallelUpsertsToFhir = 10;
const iheGateway = makeIheGatewayAPIForDocRetrieval();
const resultPoller = makeOutboundResultPoller();

export async function processOutboundDocumentQueryResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundDocQueryRespParam): Promise<void> {
  const { log } = out(`CQ DR - requestId ${requestId}, patient ${patientId}`);

  const interrupt = buildInterrupt({ requestId, patientId, cxId, log });
  if (!iheGateway) return interrupt(`IHE GW not available`);
  if (!resultPoller.isDREnabled()) return interrupt(`IHE DR result poller not available`);
  if (!(await isCQDirectEnabledForCx(cxId))) return interrupt(`CQ disabled for cx ${cxId}`);

  try {
    const patient = await getPatientOrFail({ id: patientId, cxId: cxId });
    const docQueryStartedAt = patient.data.documentQueryProgress?.startedAt;
    const duration = elapsedTimeFromNow(docQueryStartedAt);

    const docRefs = results.map(toDocumentReference).flat();

    analytics({
      distinctId: cxId,
      event: EventTypes.documentQuery,
      properties: {
        requestId,
        patientId,
        hie: MedicalDataSource.CAREQUALITY,
        duration,
        documentCount: docRefs.length,
      },
    });

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
    await storeInitDocRefInFHIR(docRefsWithMetriportId, cxId, patientId, log);

    const respWithDRUrl: OutboundDocumentQueryResp[] = [];

    const replaceDqUrlWithDrUrl = async (
      outboundDocumentQueryResp: OutboundDocumentQueryResp
    ): Promise<void> => {
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

    const docsWithDqUrlV1Gateway: DocumentReferenceWithMetriportId[] = [];
    const docsWithDqUrlV2Gateway: DocumentReferenceWithMetriportId[] = [];

    const v2GatewayOIDs = await getOidsWithIHEGatewayV2Enabled();

    for (const doc of docsToDownload) {
      if (v2GatewayOIDs.includes(doc.homeCommunityId)) {
        docsWithDqUrlV2Gateway.push(doc);
      }

      docsWithDqUrlV1Gateway.push(doc);
    }

    const documentRetrievalRequestsV1 = createOutboundDocumentRetrievalReqs({
      requestId,
      cxId,
      organization,
      documentReferences: docsWithDqUrlV1Gateway,
      outboundDocumentQueryResps: respWithDRUrl,
    });

    const documentRetrievalRequestsV2 = createOutboundDocumentRetrievalReqs({
      requestId,
      cxId,
      organization,
      documentReferences: docsWithDqUrlV2Gateway,
      outboundDocumentQueryResps: respWithDRUrl,
    });

    // We send the request to IHE Gateway to initiate the doc retrieval with doc references by each respective gateway.
    log(`Starting document retrieval, ${docsToDownload.length} docs to download`);

    log(`Starting document retrieval - Gateway V2`);
    const iheGatewayV2 = makeIHEGatewayV2();
    await iheGatewayV2.startDocumentRetrievalGatewayV2({
      drRequestsGatewayV2: documentRetrievalRequestsV2,
      requestId,
      patientId,
      cxId,
    });

    log(`Starting document retrieval - Gateway V1`);
    await iheGateway.startDocumentsRetrieval({
      outboundDocumentRetrievalReq: documentRetrievalRequestsV1,
    });

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
