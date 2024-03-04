import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { isCQDirectEnabledForCx } from "../../aws/appConfig";
import { resetDocQueryProgress } from "../../hie/reset-doc-query-progress";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { makeIheGatewayAPIForDocQuery } from "../../ihe-gateway/api";
import { makeOutboundResultPoller } from "../../ihe-gateway/outbound-result-poller-factory";
import { getCQDirectoryEntry } from "../command/cq-directory/get-cq-directory-entry";
import { getCQPatientData } from "../command/cq-patient-data/get-cq-data";
import { CQLink } from "../cq-patient-data";
import { createOutboundDocumentQueryRequests } from "./create-outbound-document-query-req";

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

  const interrupt = buildInterrupt({ patientId, cxId, log });
  if (!iheGateway) return interrupt(`IHE GW not available`);
  if (!resultPoller.isDQEnabled()) return interrupt(`IHE DQ result poller not available`);
  if (!(await isCQDirectEnabledForCx(cxId))) return interrupt(`CQ disabled for cx ${cxId}`);

  try {
    const [organization, cqPatientData] = await Promise.all([
      getOrganizationOrFail({ cxId }),
      getCQPatientData({ id: patient.id, cxId }),
    ]);

    if (!cqPatientData || cqPatientData.data.links.length <= 0) {
      return interrupt(`Patient has no CQ links, skipping DQ`);
    }

    const linksWithDqUrl: CQLink[] = [];
    const addDqUrlToCqLink = async (patientLink: CQLink): Promise<void> => {
      const gateway = await getCQDirectoryEntry(patientLink.oid);

      if (!gateway) {
        const msg = `Gateway not found - Doc Query`;
        console.log(`${msg}: ${patientLink.oid} skipping...`);
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

    const documentQueryRequests = createOutboundDocumentQueryRequests({
      requestId,
      patientId,
      cxId,
      organization,
      cqLinks: linksWithDqUrl,
    });

    // We send the request to IHE Gateway to initiate the doc query.
    // Then as they are processed by each gateway it will start
    // sending them to the internal route one by one
    log(`Starting document query`);
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

function buildInterrupt({
  patientId,
  cxId,
  log,
}: {
  patientId: string;
  cxId: string;
  log: typeof console.log;
}) {
  return async (reason: string): Promise<void> => {
    log(reason + ", skipping DQ");
    await resetDocQueryProgress({
      patient: { id: patientId, cxId },
      source: MedicalDataSource.CAREQUALITY,
    });
  };
}
