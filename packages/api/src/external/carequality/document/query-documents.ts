import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { setDocumentQueryStatus } from "../../../command/medical/document-query";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { isCQDirectEnabledForCx, isStalePatientUpdateEnabledForCx } from "../../aws/app-config";
import { isFacilityEnabledToQueryCQ } from "../../carequality/shared";
import { scheduleDocQuery } from "../../hie/schedule-document-query";
import { makeIHEGatewayV2 } from "../../ihe-gateway-v2/ihe-gateway-v2-factory";
import { makeOutboundResultPoller } from "../../ihe-gateway/outbound-result-poller-factory";
import { getCQDirectoryEntry } from "../command/cq-directory/get-cq-directory-entry";
import { getCQPatientData } from "../command/cq-patient-data/get-cq-data";
import { CQLink } from "../cq-patient-data";
import { discover, getCQData } from "../patient";
import { getCqInitiator } from "../shared";
import { createOutboundDocumentQueryRequests } from "./create-outbound-document-query-req";
import { filterCqLinksByManagingOrg } from "./filter-oids-by-managing-org";

const staleLookbackHours = 24;

const resultPoller = makeOutboundResultPoller();

export async function getDocumentsFromCQ({
  requestId,
  facilityId,
  patient,
  cqManagingOrgName,
  forcePatientDiscovery = false,
  triggerConsolidated = false,
}: {
  requestId: string;
  facilityId?: string;
  patient: Patient;
  cqManagingOrgName?: string;
  forcePatientDiscovery?: boolean;
  triggerConsolidated?: boolean;
}) {
  const { id: patientId, cxId } = patient;
  const { log } = out(`CQ DQ - requestId ${requestId}, patient ${patientId}`);

  if (!resultPoller.isDQEnabled()) {
    log(`IHE DQ result poller not available`);
    return;
  }
  if (!(await isCQDirectEnabledForCx(cxId))) {
    log(`CQ disabled for cx ${cxId}`);
    return;
  }
  if (!(await isFacilityEnabledToQueryCQ(facilityId, { id: patientId, cxId }))) {
    log(`CQ disabled for facility ${facilityId}`);
    return;
  }

  const docQueryParms = {
    cxId,
    patientId,
    requestId,
    source: MedicalDataSource.CAREQUALITY,
  };

  try {
    const [cqPatientData, initiator] = await Promise.all([
      getCQPatientData({ id: patient.id, cxId }),
      getCqInitiator(patient, facilityId),
      setDocumentQueryStatus({
        ...docQueryParms,
        progressType: "download",
        status: "processing",
      }),
      setDocumentQueryStatus({
        ...docQueryParms,
        progressType: "convert",
        status: "processing",
      }),
    ]);

    const currentPatient = await getPatientOrFail({ id: patientId, cxId });
    const patientCQData = getCQData(currentPatient.data.externalData);
    const hasNoCQStatus = !patientCQData || !patientCQData.discoveryStatus;
    const isProcessing = patientCQData?.discoveryStatus === "processing";
    const updateStalePatients = await isStalePatientUpdateEnabledForCx(cxId);
    const now = buildDayjs(new Date());
    const patientCreatedAt = buildDayjs(patient.createdAt);
    const pdStartedAt = patientCQData?.discoveryParams?.startedAt
      ? buildDayjs(patientCQData.discoveryParams.startedAt)
      : undefined;
    const isStale =
      updateStalePatients &&
      (pdStartedAt ?? patientCreatedAt) < now.subtract(staleLookbackHours, "hours");

    if (hasNoCQStatus || isProcessing || forcePatientDiscovery || isStale) {
      await scheduleDocQuery({
        requestId,
        patient,
        source: MedicalDataSource.CAREQUALITY,
        triggerConsolidated,
      });

      if ((forcePatientDiscovery || isStale) && !isProcessing) {
        discover({
          patient,
          facilityId: initiator.facilityId,
          requestId,
        }).catch(processAsyncError("CQ discover"));
      }

      return;
    }
    if (!cqPatientData || cqPatientData.data.links.length <= 0) {
      log(`Patient has no CQ links, skipping DQ`);
      return;
    }

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
      patient,
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
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: documentQueryRequestsV2.length,
    });
  } catch (error) {
    const msg = `Failed to query and process documents - Carequality`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await Promise.all([
      setDocumentQueryStatus({
        cxId,
        patientId,
        requestId,
        source: MedicalDataSource.CAREQUALITY,
        progressType: "download",
        status: "failed",
      }),
      setDocumentQueryStatus({
        cxId,
        patientId,
        requestId,
        source: MedicalDataSource.CAREQUALITY,
        progressType: "convert",
        status: "failed",
      }),
    ]);

    capture.error(msg, {
      extra: {
        context: `cq.queryAndProcessDocuments`,
        error,
        patientId: patient.id,
        requestId,
      },
    });
    throw error;
  }
}
