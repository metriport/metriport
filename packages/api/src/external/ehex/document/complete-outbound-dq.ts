import { isEhexEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { failPatientStateDq } from "@metriport/core/command/patient-state/dq/fail";
import { createPatientStateDr } from "@metriport/core/command/patient-state/dr/create";
import { MedicalDataSource } from "@metriport/core/external";
import { OutboundDocQueryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { ehexExtension } from "@metriport/core/external/ehex/extension";
import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { capture, executeAsynchronously, out } from "@metriport/core/util";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { DocumentReference, OutboundDocumentQueryResp } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { mapDocRefToMetriport } from "../../../shared/external";
import { makeEhexGateway } from "../../ehex-gateway/ehex-gateway-factory";
import { upsertDocumentToFHIRServer } from "../../fhir/document/save-document-reference";
import { iheToFhirDocumentReference } from "../../ihe-shared/ihe-to-fhir";
import { getEhexDirectoryEntry } from "../command/directory/get-ehex-directory-entry";
import { OutboundEhexDocQueryRespParam } from "../gateway-result";
import { getEhexInitiator } from "../shared";
import { createOutboundDocumentRetrievalReqs } from "./create-outbound-document-retrieval-req";
import { getNonExistentDocRefs } from "./get-non-existent-doc-refs";
import {
  containsDuplicateMetriportId,
  containsMetriportId,
  DocumentReferenceWithMetriportId,
} from "./shared";

const parallelUpsertsToFhir = 10;
const parallelDocRefMappings = 10;

type DqRespWithDocRefsWithMetriportId = OutboundDocumentQueryResp & {
  documentReference: DocumentReferenceWithMetriportId[];
};

export async function completeOutboundDqAndStartDr({
  requestId,
  patientId,
  cxId,
  response,
  forceDownload,
}: OutboundEhexDocQueryRespParam): Promise<void> {
  const { log } = out(`eHex DR - requestId ${requestId}, patient ${patientId}`);

  // TODO: 1665 - Perhaps not needed?...
  if (!(await isEhexEnabledForCx(cxId))) throw new MetriportError(`eHex disabled for cx ${cxId}`);

  try {
    const patient = await getPatientOrFail({ id: patientId, cxId: cxId });

    const docsToDownload = await getRespWithDocsToDownload({
      cxId,
      patientId,
      requestId,
      response,
      forceDownload,
    });

    const totalDocsFound = response.reduce(
      (sum, resp) => sum + (resp.documentReference?.length ?? 0),
      0
    );
    const docsToDownloadCount = docsToDownload.flatMap(r => r.documentReference).length;

    await createPatientStateDr({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      params: {
        requestId,
        facilityId: patient.facilityIds[0] ?? "",
        countTotal: totalDocsFound,
        countFilteredFromRedownload: totalDocsFound - docsToDownloadCount,
        forceDownload,
      },
    });

    // TODO: 1665 - Add analytics
    if (docsToDownloadCount === 0) {
      log(`No new documents to download.`);
      return;
    }

    log(`I have ${docsToDownloadCount} docs to download`);

    await storeInitDocRefInFHIR(
      docsToDownload.flatMap(r => r.documentReference),
      cxId,
      patientId,
      log
    );

    const outboundDocumentQueryResults = await replaceDqUrlWithDrUrl({
      responsesWithDocsToDownload: docsToDownload,
      log,
    });

    const initiator = await getEhexInitiator(patient);

    const drRequests = createOutboundDocumentRetrievalReqs({
      requestId,
      patient,
      initiator,
      outboundDocumentQueryResults,
    });

    log(`Starting document retrieval, ${drRequests.length} requests to send`);

    if (drRequests.length > 0) {
      log(`Starting document retrieval`);
      const ehexGateway = makeEhexGateway();
      await ehexGateway.startDocumentRetrievalGateway({
        drRequests,
        requestId,
        patientId,
        cxId,
      });
    }
  } catch (error) {
    const msg = `Failed to process documents in eHex.`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await failPatientStateDq({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      requestId,
      reason: errorToString(error),
    });

    capture.message(msg, {
      extra: {
        context: `ehex.processOutboundDocumentQueryResps`,
        error: errorToString(error),
        patientId,
        requestId,
        cxId,
      },
      level: "error",
    });
    throw error;
  }
}

/**
 * FUNCTIONS BELOW ARE MOSTLY COPY-PASTED FROM CQ
 */
async function getRespWithDocsToDownload({
  cxId,
  patientId,
  requestId,
  response,
  forceDownload,
}: OutboundDocQueryRespParam): Promise<DqRespWithDocRefsWithMetriportId[]> {
  const respWithDocsToDownload: DqRespWithDocRefsWithMetriportId[] = [];
  const seenMetriportIds = new Set<string>();

  const fhirDocRefs = await getDocuments({ cxId, patientId });

  await executeAsynchronously(
    response,
    async gwResp => {
      const resultsWithMetriportId = await getDocumentReferencesWithMetriportId({
        cxId,
        patientId,
        requestId,
        response: gwResp,
      });

      const docRefs = resultsWithMetriportId.flatMap(result => result.documentReference ?? []);

      const docRefsWithMetriportId = docRefs.filter(containsMetriportId);

      const deduplicatedDocRefsWithMetriportId = docRefsWithMetriportId.filter(
        docRef => !containsDuplicateMetriportId(docRef, seenMetriportIds)
      );

      const docsToDownload = await getNonExistentDocRefs(
        deduplicatedDocRefsWithMetriportId,
        patientId,
        cxId,
        fhirDocRefs,
        forceDownload
      );

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

async function getDocumentReferencesWithMetriportId({
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

  const docRefsWithMetriportId: DocumentReferenceWithMetriportId[] = [];

  await executeAsynchronously(
    docRefs,
    async docRef => {
      const docRefWithMetriportId = await addMetriportDocRefID({
        cxId,
        patientId,
        requestId,
        document: docRef,
      });
      docRefsWithMetriportId.push(docRefWithMetriportId);
    },
    { numberOfParallelExecutions: parallelDocRefMappings }
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
}): Promise<DocumentReferenceWithMetriportId> {
  const documentId = document.docUniqueId;

  const { metriportId, originalId } = await mapDocRefToMetriport({
    cxId,
    patientId,
    documentId,
    requestId,
    source: MedicalDataSource.EHEX,
  });

  return {
    ...document,
    docUniqueId: originalId,
    metriportId,
  };
}

async function replaceDqUrlWithDrUrl({
  responsesWithDocsToDownload,
  log,
}: {
  responsesWithDocsToDownload: OutboundDocumentQueryResp[];
  log: typeof console.log;
}): Promise<OutboundDocumentQueryResp[]> {
  const resultsWithMetriportIdAndDrUrl: OutboundDocumentQueryResp[] = [];

  await executeAsynchronously(
    responsesWithDocsToDownload,
    async outboundDocumentQueryResp => {
      const homeCommunityId = outboundDocumentQueryResp.gateway.homeCommunityId;
      const gateway = await getEhexDirectoryEntry(homeCommunityId);

      const urlDr = gateway?.urlDr;
      if (!urlDr) {
        const msg = `Gateway ${homeCommunityId} has no DR URL`;
        log(`${msg}: ${homeCommunityId} skipping...`);
        return;
      }

      resultsWithMetriportIdAndDrUrl.push({
        ...outboundDocumentQueryResp,
        gateway: {
          ...outboundDocumentQueryResp.gateway,
          url: urlDr,
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

        const fhirDocRef = iheToFhirDocumentReference({
          docId,
          docRef,
          docStatus: "preliminary",
          patientId,
          source: MedicalDataSource.EHEX,
          contentExtension: ehexExtension,
        });

        await upsertDocumentToFHIRServer(cxId, fhirDocRef, log);
      } catch (error) {
        const msg = `Failed to store initial doc ref in FHIR`;
        log(`${msg}: ${errorToString(error)}`);
        capture.message(msg, {
          extra: {
            context: `ehex.storeInitDocRefInFHIR`,
            error: errorToString(error),
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
