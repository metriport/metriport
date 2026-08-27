import { getPatientState } from "@metriport/core/command/patient-state/get-patient-state";
import { failPatientStatePd } from "@metriport/core/command/patient-state/pd/fail";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { OutboundPatientDiscoveryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { isEhexSuccessfulOutboundPatientDiscoveryResponse } from "@metriport/core/external/ehex/ehex-gateway/outbound/xcpd/process/types";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { MetriportError } from "@metriport/shared";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createOrUpdateInvalidLinks } from "../../../command/medical/invalid-links/create-invalid-links";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getNewDemographics } from "../../../domain/medical/patient-demographics";
import { checkLinkDemographicsAcrossHies } from "../../hie/check-patient-link-demographics";
import { updatePatientLinkDemographics } from "../../hie/update-patient-link-demographics";
import { validateEhexLinksBelongToPatient } from "../../hie/validate-patient-links";
import { createOrUpdateEhexPatientData } from "../command/patient-data/create-ehex-data";
import { updateEhexPatientData } from "../command/patient-data/update-ehex-data";
import { getDocumentsFromEhex } from "../document/query-documents";
import { EhexLink } from "../ehex-patient-data";
import { isEhexGroupedQueryGatewayOid } from "../gateway";
import { discover } from "../patient";
import {
  getPatientResources,
  patientResourceToNormalizedLinkDemographics,
} from "../patient-demographics";

dayjs.extend(duration);

const context = "ehex.completeOutboundPd";

export async function completeOutboundPd({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundPatientDiscoveryRespParam): Promise<void> {
  const baseLogMessage = `${context} - cxId: ${cxId}, ptId: ${patientId}`;
  const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);
  const { log: outerLog } = out(baseLogMessage);
  try {
    const [patient, patientState] = await Promise.all([
      getPatientOrFail({ id: patientId, cxId }),
      getPatientState({
        patientId,
        network: MedicalDataSource.EHEX,
        requestId,
        cxId,
      }),
    ]);
    // TODO ENG-1978 - Remove this once we're happy w/ the flow
    log(`Starting to handle pd results, patientState is ${JSON.stringify(patientState)}`);
    const { validNetworkLinks } = await validateAndCreateEhexLinks(patient, results);

    const { pd: pdState, dq: scheduledDqState } = patientState ?? {};
    if (!pdState) {
      const msg = `Failed to find discovery params @ Ehex`;
      log(`${msg}. Patient ID: ${patient.id}.`);
      throw new MetriportError(msg, undefined, {
        requestId,
        patientId: patient.id,
      });
    }

    if (pdState.rerunPdOnNewDemographics || pdState.isForceNewPdRun) {
      const startedNewPd = await runNextPdOnNewDemographics({
        patient,
        facilityId: pdState.facilityId,
        requestId,
        ehexLinks: validNetworkLinks,
        isTargetedQuery: pdState.isTargetedQuery,
        isForceNewPdRun: pdState.isForceNewPdRun,
      });
      if (startedNewPd) return;
    }

    const startedNewPd = await runNextPdIfScheduled({
      patient,
      requestId,
    });
    if (startedNewPd) return;

    // If dq state already exists under the same request id, it's a scheduled dq
    if (scheduledDqState) {
      getDocumentsFromEhex({
        patient,
        facilityId: scheduledDqState.facilityId,
        requestId,
        forceDownload: scheduledDqState.forceDownload,
      }).catch(processAsyncError("eHex scheduled dq"));
    }
  } catch (error) {
    await failPatientStatePd({
      patientId,
      cxId,
      network: MedicalDataSource.EHEX,
      requestId,
      reason: errorToString(error),
    });

    // TODO: 1849
    // await resetScheduledPatientDiscovery({
    //   patient: patientIds,
    //   source: MedicalDataSource.EHEX,
    // });
    const msg = `Error on processing Outbound PD responses`;
    outerLog(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patientId,
        results,
        context,
        error: errorToString(error),
      },
    });
  }
}

async function validateAndCreateEhexLinks(
  patient: Patient,
  pdResults: OutboundPatientDiscoveryResp[]
): Promise<{ validNetworkLinks: EhexLink[]; invalidLinks: EhexLink[] }> {
  const { id, cxId } = patient;
  const ehexLinks = buildEhexLinks(pdResults);

  const { validNetworkLinks, invalidLinks } = await validateEhexLinksBelongToPatient(
    cxId,
    ehexLinks,
    patient.data
  );

  const promises = [];

  if (validNetworkLinks.length > 0) {
    promises.push(createOrUpdateEhexPatientData({ id, cxId, ehexLinks: validNetworkLinks }));
  }

  if (invalidLinks.length > 0) {
    promises.push(
      createOrUpdateInvalidLinks({
        id,
        cxId,
        invalidLinks: {
          ehex: invalidLinks,
        },
      })
    );
  }

  await Promise.all(promises);

  return { validNetworkLinks, invalidLinks };
}

function buildEhexLinks(pdResults: OutboundPatientDiscoveryResp[]): EhexLink[] {
  const { log } = out("buildEhexLinks");
  return pdResults.flatMap(pd => {
    if (!isEhexSuccessfulOutboundPatientDiscoveryResponse(pd)) {
      return [];
    }

    const url = pd.gateway.url;
    if (!url) return [];

    const links: EhexLink[] = [];
    for (const patientMatch of pd.patientMatches) {
      const { patientResource, externalGatewayPatient } = patientMatch;
      const { id, system } = externalGatewayPatient;
      if (!id || !system) continue;

      /**
       * When we run a grouped query, the organization OID is created by us, and has a Metriport OID root.
       * In that case, we want to make sure to include the OID of the system that returned the patient match,
       * not the Metriport-based grouped query OID.
       *
       * For targeted queries, the gateway OID is the correct value to use.
       *
       * Custodian OID is the OID that we should use to query for documents.
       */
      const isGroupedQueryLink = isEhexGroupedQueryGatewayOid(pd.gateway.oid);
      const custodianOid = patientMatch.custodianOid;
      if (isGroupedQueryLink && !custodianOid) {
        const msg = "Custodian OID is missing from the XCPD response";
        const extra = {
          patientId: pd.patientId,
          cxId: pd.cxId,
          requestId: pd.id,
          gateway: pd.gateway,
        };
        log(`${msg} - ${JSON.stringify(extra)}`);
      }

      const oidToUse = custodianOid ? custodianOid : isGroupedQueryLink ? system : pd.gateway.oid;

      // TODO: 1906 - Remove when validated in prod
      log(
        `${isGroupedQueryLink ? "Grouped" : "Targeted"} Query - Original GW Oid: ${
          pd.gateway.oid
        }, System: ${system}, Custodian OID: ${custodianOid}. Using: ${oidToUse}`
      );

      links.push({
        patientId: id,
        systemId: system,
        oid: oidToUse,
        url,
        id: pd.gateway.id,
        patientResource,
      });
    }
    return links;
  });
}

export async function runNextPdOnNewDemographics({
  patient,
  facilityId,
  requestId,
  ehexLinks,
  isTargetedQuery,
  isForceNewPdRun,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  ehexLinks: EhexLink[];
  isTargetedQuery: boolean;
  isForceNewPdRun?: boolean | undefined;
}): Promise<boolean> {
  const updatedPatient = await getPatientOrFail(patient);

  const linksDemographics = getPatientResources(ehexLinks).map(
    patientResourceToNormalizedLinkDemographics
  );
  const newDemographicsHere = getNewDemographics(updatedPatient, linksDemographics);
  const foundNewDemographicsHere = newDemographicsHere.length > 0;
  const foundNewDemographicsAcrossHies = await checkLinkDemographicsAcrossHies({
    patient: updatedPatient,
    requestId,
  });
  if (!foundNewDemographicsHere && !foundNewDemographicsAcrossHies && !isForceNewPdRun) {
    return false;
  }

  if (foundNewDemographicsHere) {
    await Promise.all([
      updateEhexPatientData({
        id: updatedPatient.id,
        cxId: updatedPatient.cxId,
        requestLinksDemographics: {
          requestId,
          linksDemographics: newDemographicsHere,
        },
      }),
      updatePatientLinkDemographics({
        requestId,
        patient: updatedPatient,
        source: MedicalDataSource.EHEX,
        links: newDemographicsHere,
      }),
    ]);
  }
  discover({
    patient: updatedPatient,
    facilityId,
    rerunPdOnNewDemographics: false,
    isUseAugmentedDemographics: true,
    overrideIsTargetedQueryEnabled: isTargetedQuery,
  }).catch(processAsyncError("Ehex discover"));
  analytics({
    distinctId: updatedPatient.cxId,
    event: EventTypes.rerunOnNewDemographics,
    properties: {
      hie: MedicalDataSource.EHEX,
      patientId: updatedPatient.id,
      requestId,
      foundNewDemographicsHere,
      foundNewDemographicsAcrossHies,
    },
  });
  return true;
}

export async function runNextPdIfScheduled({
  patient,
  requestId,
}: {
  patient: Patient;
  requestId: string;
}): Promise<boolean> {
  // TODO: 1849 - Implement this
  out("runNextPdIfScheduled").log(`not implemented. ptId: ${patient.id}, reqId: ${requestId}`);
  return false;
}
