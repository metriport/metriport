import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { isCQDirectEnabledForCx } from "../../aws/appConfig";
import { buildInterrupt } from "../../hie/reset-doc-query-progress";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { makeIheGatewayAPIForDocQuery } from "../../ihe-gateway/api";
import { makeOutboundResultPoller } from "../../ihe-gateway/outbound-result-poller-factory";
import { getCQDirectoryEntry } from "../command/cq-directory/get-cq-directory-entry";
import { getCQPatientData } from "../command/cq-patient-data/get-cq-data";
import { CQLink } from "../cq-patient-data";
import { getCQData } from "../patient";
import { createOutboundDocumentQueryRequests } from "./create-outbound-document-query-req";
import { scheduleDocQuery } from "../../hie/schedule-document-query";
import { getOIDsWithGirthEnabledFeatureFlagValue } from "../../aws/appConfig";
import { startDocumentQueryGirth } from "@metriport/core/external/carequality/ihe-gateway-v2/dq/invoke-document-query";

const iheGateway = makeIheGatewayAPIForDocQuery();
const resultPoller = makeOutboundResultPoller();

export async function getDocumentsFromCQ({
  requestId,
  patient,
}: {
  requestId: string;
  patient: Patient;
}) {
  const { log } = out(`CQ DQ - requestId ${requestId}, patient ${patient.id}`);
  const { cxId, id: patientId } = patient;

  const interrupt = buildInterrupt({ patientId, cxId, source: MedicalDataSource.CAREQUALITY, log });
  if (!iheGateway) return interrupt(`IHE GW not available`);
  if (!resultPoller.isDQEnabled()) return interrupt(`IHE DQ result poller not available`);
  if (!(await isCQDirectEnabledForCx(cxId))) return interrupt(`CQ disabled for cx ${cxId}`);

  try {
    const [organization, cqPatientData] = await Promise.all([
      getOrganizationOrFail({ cxId }),
      getCQPatientData({ id: patient.id, cxId }),
      setDocQueryProgress({
        patient: { id: patient.id, cxId: patient.cxId },
        downloadProgress: { status: "processing" },
        convertProgress: { status: "processing" },
        requestId,
        source: MedicalDataSource.CAREQUALITY,
      }),
    ]);

    // If DQ is triggered while the PD is in progress, schedule it to be done when PD is completed
    if (getCQData(patient.data.externalData)?.discoveryStatus === "processing") {
      await scheduleDocQuery({ requestId, patient, source: MedicalDataSource.CAREQUALITY });
      return;
    }
    if (!cqPatientData || cqPatientData.data.links.length <= 0) {
      return interrupt(`Patient has no CQ links, skipping DQ`);
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

    // separate mirth and girth here
    const linksWithDqUrlNoGirth: CQLink[] = [];
    const linksWithDqUrlGirth: CQLink[] = [];
    for (const link of linksWithDqUrl) {
      if ((await getOIDsWithGirthEnabledFeatureFlagValue()).includes(link.oid)) {
        linksWithDqUrlGirth.push(link);
      } else {
        linksWithDqUrlNoGirth.push(link);
      }
    }

    // no girth requests
    const documentQueryRequests = createOutboundDocumentQueryRequests({
      requestId,
      patientId,
      cxId,
      organization,
      cqLinks: linksWithDqUrlNoGirth,
    });

    // girth requests
    const documentQueryRequestsGirth = createOutboundDocumentQueryRequests({
      requestId,
      patientId,
      cxId,
      organization,
      cqLinks: linksWithDqUrlGirth,
    });

    log(`Starting document query - Girth`);
    await startDocumentQueryGirth({ dqRequestsGirth: documentQueryRequestsGirth, patientId, cxId });

    // We send the request to IHE Gateway to initiate the doc query.
    // Then as they are processed by each gateway it will start
    // sending them to the internal route one by one
    log(`Starting document query - No Girth`);
    await iheGateway.startDocumentsQuery({ outboundDocumentQueryReq: documentQueryRequests });

    await resultPoller.pollOutboundDocQueryResults({
      requestId,
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: documentQueryRequests.length,
    });
  } catch (error) {
    const msg = `Failed to query and process documents - Carequality`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await setDocQueryProgress({
      patient: { id: patient.id, cxId: patient.cxId },
      downloadProgress: { status: "failed" },
      convertProgress: { status: "failed" },
      requestId,
      source: MedicalDataSource.CAREQUALITY,
    });

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
