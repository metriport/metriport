import { isEhexEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { createPatientStateDq } from "@metriport/core/command/patient-state/dq/create";
import { failPatientStateDq } from "@metriport/core/command/patient-state/dq/fail";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { makeEhexGateway } from "../../ehex-gateway/ehex-gateway-factory";
import { isFacilityEnabledToQueryEhex } from "../../ehex/shared";
import { buildInterrupt } from "../../hie/reset-doc-query-progress";
import { getEhexDirectoryEntry } from "../command/directory/get-ehex-directory-entry";
import { getEhexPatientData } from "../command/patient-data/get-ehex-data";
import { EhexLink } from "../ehex-patient-data";
import { getEhexInitiator } from "../shared";
import { createOutboundDocumentQueryRequests } from "./create-outbound-document-query-req";
import { filterEhexLinksByManagingOrg } from "./filter-oids-by-managing-org";

// const staleLookbackWeeks = 2;

// TODO: 1849 - Implement forcePatientDiscovery and triggerConsolidated
export async function getDocumentsFromEhex({
  requestId,
  facilityId,
  patient,
  forceDownload = false,
  // forcePatientDiscovery = false,
  // triggerConsolidated = false,
  ehexManagingOrgName,
}: {
  requestId: string;
  facilityId: string | undefined;
  patient: Patient;
  forceDownload?: boolean;
  ehexManagingOrgName?: string;
  // forcePatientDiscovery?: boolean;
  // triggerConsolidated?: boolean;
}) {
  const { log } = out(`Ehex DQ - requestId ${requestId}, patient ${patient.id}`);
  const { cxId, id: patientId } = patient;

  const interrupt = buildInterrupt({
    patientId,
    requestId,
    cxId,
    source: MedicalDataSource.EHEX,
    log,
  });

  const isEhexQueryEnabled = await isFacilityEnabledToQueryEhex(facilityId, {
    id: patientId,
    cxId,
  });

  if (!(await isEhexEnabledForCx(cxId))) return interrupt(`Ehex disabled for cx ${cxId}`);
  if (!isEhexQueryEnabled) return interrupt(`Ehex disabled for facility ${facilityId}`);

  try {
    const [ehexPatientData, initiator] = await Promise.all([
      getEhexPatientData({ id: patientId, cxId }),
      getEhexInitiator(patient, facilityId),
    ]);

    if (!ehexPatientData || ehexPatientData.data.links.length <= 0) {
      return interrupt(`Patient has no Ehex links, skipping DQ`);
    }

    const linksWithDqUrl: EhexLink[] = [];
    await executeAsynchronously(
      ehexPatientData.data.links,
      patientLink => addDqUrlToEhexLink(patientLink, linksWithDqUrl, log),
      {
        numberOfParallelExecutions: 20,
      }
    );

    const ehexLinks = ehexManagingOrgName
      ? await filterEhexLinksByManagingOrg(ehexManagingOrgName, linksWithDqUrl)
      : linksWithDqUrl;

    const dqRequests = createOutboundDocumentQueryRequests({
      requestId,
      patient,
      initiator,
      cxId,
      ehexLinks,
    });

    await createPatientStateDq({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      params: {
        requestId,
        facilityId: initiator.facilityId,
        totalGateways: dqRequests.length,
        totalDocuments: 0,
        forceDownload,
      },
    });

    if (dqRequests.length > 0) {
      log(`Starting document query - Gateway V2`);
      const ehexGateway = makeEhexGateway();
      await ehexGateway.startDocumentQueryGateway({
        dqRequests,
        requestId,
        patientId,
        cxId,
      });
    }
  } catch (error) {
    const msg = `Failed to query and process documents - eHex`;
    log(`${msg}. Error: ${errorToString(error)}`);

    await failPatientStateDq({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      requestId,
      reason: errorToString(error),
    });

    capture.error(msg, {
      extra: {
        context: `ehex.queryAndProcessDocuments`,
        error: errorToString(error),
        patientId: patient.id,
        requestId,
        cxId,
      },
    });
    throw error;
  }
}

async function addDqUrlToEhexLink(
  patientLink: EhexLink,
  linksWithDqUrl: EhexLink[],
  log: typeof console.log
): Promise<void> {
  const gateway = await getEhexDirectoryEntry(patientLink.oid);

  if (!gateway) {
    log(`eHex gateway not found for DQ: ${patientLink.oid}; skipping...`);
    return;
  } else if (!gateway.urlDq) {
    log(`eHex gateway ${patientLink.oid} has no DQ URL; skipping...`);
    return;
  }

  linksWithDqUrl.push({
    ...patientLink,
    url: gateway.urlDq,
  });
}
