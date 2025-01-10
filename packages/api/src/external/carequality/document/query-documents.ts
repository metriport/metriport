import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { isCQDirectEnabledForCx } from "../../aws/app-config";
import { isFacilityEnabledToQueryCQ } from "../../carequality/shared";
import { buildInterrupt } from "../../hie/reset-doc-query-progress";
import { scheduleDocQuery } from "../../hie/schedule-document-query";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { setDocQueryStartAt } from "../../hie/set-doc-query-start";
import { makeIHEGatewayV2 } from "../../ihe-gateway-v2/ihe-gateway-v2-factory";
import { makeOutboundResultPoller } from "../../ihe-gateway/outbound-result-poller-factory";
import { getCQDirectoryEntry } from "../command/cq-directory/get-cq-directory-entry";
import { getCQPatientData } from "../command/cq-patient-data/get-cq-data";
import { CQLink } from "../cq-patient-data";
import { discover } from "../patient";
import { getCqInitiator } from "../shared";
import { createOutboundDocumentQueryRequests } from "./create-outbound-document-query-req";
import { filterCqLinksByManagingOrg } from "./filter-oids-by-managing-org";

const resultPoller = makeOutboundResultPoller();

export async function getDocumentsFromCQ({
  patient: patientParam,
  requestId,
  facilityId,
  cqManagingOrgName,
  triggerConsolidated = false,
  forcePatientDiscoveryOnScheduling = false,
}: {
  patient: Patient;
  requestId: string;
  facilityId?: string;
  cqManagingOrgName?: string;
  triggerConsolidated?: boolean;
  forcePatientDiscoveryOnScheduling?: boolean;
}) {
  const { id: patientId, cxId } = patientParam;
  const { log } = out(`CQ DQ - requestId ${requestId}, patient ${patientId}`);

  const interrupt = buildInterrupt({
    patientId,
    cxId,
    requestId,
    source: MedicalDataSource.CAREQUALITY,
    log,
  });

  const isCqQueryEnabled = await isFacilityEnabledToQueryCQ(facilityId, { id: patientId, cxId });

  if (!resultPoller.isDQEnabled()) return interrupt(`IHE DQ result poller not available`);
  if (!(await isCQDirectEnabledForCx(cxId))) return interrupt(`CQ disabled for cx ${cxId}`);
  if (!isCqQueryEnabled) return interrupt(`CQ disabled for facility ${facilityId}`);

  try {
    const [cqPatientData, initiator] = await Promise.all([
      getCQPatientData({ id: patientId, cxId }),
      getCqInitiator(patientParam, facilityId),
      setDocQueryProgress({
        patient: { id: patientId, cxId },
        downloadProgress: { status: "processing" },
        convertProgress: { status: "processing" },
        requestId,
        source: MedicalDataSource.CAREQUALITY,
        triggerConsolidated,
      }),
    ]);

    const patientWithScheduledDocQuery = await scheduleDocQuery<{ facilityId: string }>({
      requestId,
      patient: { id: patientId, cxId },
      source: MedicalDataSource.CAREQUALITY,
      triggerConsolidated,
      patientDiscoveryActions: {
        pd: discover,
        extraPdArgs: {
          facilityId: initiator.facilityId,
        },
      },
      forcePatientDiscoveryOnScheduling,
    });

    if (patientWithScheduledDocQuery.data.externalData?.CAREQUALITY?.scheduledDocQueryRequestId)
      return;

    if (!cqPatientData || cqPatientData.data.links.length <= 0) {
      return interrupt(`Patient has no CQ links, skipping DQ`);
    }

    await setDocQueryStartAt({
      patient: { id: patientId, cxId },
      source: MedicalDataSource.CAREQUALITY,
      startedAt: new Date(),
    });

    const linksWithDqUrl: CQLink[] = [];
    const addDqUrlToCqLink = async (patientLink: CQLink): Promise<void> => {
      const gateway = await getCQDirectoryEntry(patientLink.oid);

      if (!gateway) {
        const msg = `Gateway not found - Doc Query`;
        log(`${msg}: ${patientLink.oid} skipping...`);
        capture.message(msg, {
          extra: {
            context: `cq.pd.getCQDirectoryEntry`,
            patientId,
            requestId,
            cxId,
            gateway: patientLink,
          },
        });
        return;
      } else if (!gateway.urlDQ) {
        log(`Gateway ${gateway.id} has no DQ URL, skipping...`);
        return;
      }

      linksWithDqUrl.push({
        ...patientLink,
        url: gateway.urlDQ,
      });
    };
    await executeAsynchronously(cqPatientData.data.links, addDqUrlToCqLink, {
      numberOfParallelExecutions: 20,
    });

    const cqLinks = cqManagingOrgName
      ? await filterCqLinksByManagingOrg(cqManagingOrgName, linksWithDqUrl)
      : linksWithDqUrl;

    const documentQueryRequestsV2 = createOutboundDocumentQueryRequests({
      requestId,
      patient: patientParam,
      initiator,
      cxId,
      cqLinks,
    });

    // We send the request to IHE Gateway to initiate the doc query.
    // Then as they are processed by each gateway it will start
    // sending them to the internal route one by one
    if (documentQueryRequestsV2.length > 0) {
      log(`Starting document query - Gateway V2`);
      const iheGatewayV2 = makeIHEGatewayV2();
      await iheGatewayV2.startDocumentQueryGatewayV2({
        dqRequestsGatewayV2: documentQueryRequestsV2,
        requestId,
        patientId,
        cxId,
      });
    }

    await resultPoller.pollOutboundDocQueryResults({
      requestId,
      patientId,
      cxId,
      numOfGateways: documentQueryRequestsV2.length,
    });
  } catch (error) {
    const msg = `Failed to query and process documents - Carequality`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await setDocQueryProgress({
      patient: { id: patientId, cxId },
      downloadProgress: { status: "failed" },
      convertProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

    capture.error(msg, {
      extra: {
        context: `cq.getDocumentsFromCQ`,
        error,
        patientId,
        facilityId,
        requestId,
      },
    });
    throw error;
  }
}
