import {
  isDemoAugEnabledForCx,
  isEhexTargetedQueriesEnabled,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { createPatientStateDq } from "@metriport/core/command/patient-state/dq/create";
import { createPatientStatePd } from "@metriport/core/command/patient-state/pd/create";
import { failPatientStatePd } from "@metriport/core/command/patient-state/pd/fail";
import { Patient } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external";
import { toEhexGatewayPatientResource } from "@metriport/core/external/ehex/ehex-gateway/patient";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString, MetriportError } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  createAugmentedPatient,
  linkHasNewDemographics,
  patientToNormalizedCoreDemographics,
} from "../../domain/medical/patient-demographics";
import { makeEhexGateway } from "../ehex-gateway/ehex-gateway-factory";
import { deleteEhexPatientData } from "./command/patient-data/delete-ehex-data";
import { createOutboundPatientDiscoveryReq } from "./create-outbound-patient-discovery-req";
import { gatherXCPDGateways, getGroupedQueryGateways } from "./gateway";
import { getEhexInitiator, isEhexEnabled } from "./shared";

dayjs.extend(duration);

const context = "ehex.patient.discover";

/**
 * Triggers patient discovery for a specific patient in Ehex.
 *
 * @param patient - The patient to trigger discovery for.
 * @param facilityId - The facility ID that supports this request.
 * @param requestId - The request ID of this request/execution.
 * @param forceEnabled - Whether to force enable Ehex.
 * @param rerunPdOnNewDemographics - Whether to rerun PD on new demographics.
 * @param isUseAugmentedDemographics - Whether to use augmented demographics in this execution/run.
 * @param isScheduledDq - Whether to schedule a document query after patient discovery.
 * @param forceDownload - Whether to force download documents.
 * @param overrideIsTargetedQueryEnabled - Whether to override the targeted query feature flag.
 */
export async function discover({
  patient,
  facilityId,
  requestId: inputRequestId,
  forceEnabled = false,
  rerunPdOnNewDemographics,
  isUseAugmentedDemographics = false,
  isScheduledDq = false,
  forceDownload = false,
  overrideIsTargetedQueryEnabled,
}: {
  patient: Patient;
  facilityId: string;
  requestId?: string;
  forceEnabled?: boolean;
  /**
   * Setting this overrides the Augmented Demo FF. If true, runs a new PD on new demographics, false disables it.
   */
  rerunPdOnNewDemographics?: boolean;
  /**
   * If true, includes the augmented demographics on this specific run of patient discovery. Defaults to false.
   * Note: it only affects this execution, not subsequent executions, if any.
   */
  isUseAugmentedDemographics?: boolean;
  isScheduledDq?: boolean;
  forceDownload?: boolean;
  /**
   * Override the feature flag for targeted queries. When undefined, falls back to
   * the feature flag value. When explicitly set to false, forces grouped queries.
   * When explicitly set to true, forces targeted queries.
   * Note: undefined vs false matters here - undefined uses the feature flag,
   * while false explicitly disables targeted queries regardless of the flag.
   */
  overrideIsTargetedQueryEnabled?: boolean;
}): Promise<void> {
  const baseLogMessage = `eHex PD - patientId ${patient.id}, cx ${patient.cxId}`;
  const { log: outerLog } = out(baseLogMessage);

  const isEnabledEhex = await isEhexEnabled(patient, facilityId, forceEnabled, outerLog);
  if (!isEnabledEhex) return;

  const [isTargetedQueriesEnabled, isDemoAugEnabled] = await Promise.all([
    isEhexTargetedQueriesEnabled(),
    isDemoAugEnabledForCx(patient.cxId),
  ]);

  const isTargetedQuery = overrideIsTargetedQueryEnabled ?? isTargetedQueriesEnabled;

  const isRerunPdOnNewDemographics = rerunPdOnNewDemographics ?? isDemoAugEnabled;

  // TODO: 1665 - we might need to include telecom.use, i.e. "HP", etc - need to double check
  const augmentedPatient = createAugmentedPatient(patient);
  const isForceNewPdRun =
    isRerunPdOnNewDemographics &&
    hasNewDemographicsToUse({
      augmentedPatient,
      originalPatient: patient,
    });

  const isUseAugmentedDemoOnThisRun = isUseAugmentedDemographics && isDemoAugEnabled;
  const patientForPd = isUseAugmentedDemoOnThisRun ? augmentedPatient : patient;

  const requestId = inputRequestId ?? uuidv7();
  outerLog(
    `requestId: ${requestId}, ` +
      `isUseAugmentedDemoOnThisRun: ${isUseAugmentedDemoOnThisRun}, ` +
      `isRerunPdOnNewDemographics: ${isRerunPdOnNewDemographics}, ` +
      `isForceNewPdRun: ${isForceNewPdRun}, ` +
      `isTargetedQuery: ${isTargetedQuery}, ` +
      `isDemoAugEnabled: ${isDemoAugEnabled}`
  );
  await prepareAndTriggerPD({
    patient: patientForPd,
    facilityId,
    requestId,
    baseLogMessage,
    isRerunPdOnNewDemographics,
    isForceNewPdRun,
    isScheduledDq,
    forceDownload,
    isTargetedQuery,
  });
}

function hasNewDemographicsToUse({
  augmentedPatient,
  originalPatient,
}: {
  augmentedPatient: Patient;
  originalPatient: Patient;
}): boolean {
  const augmentedDemographics = patientToNormalizedCoreDemographics(augmentedPatient);
  const originalDemographics = patientToNormalizedCoreDemographics(originalPatient);
  const newDemographics = linkHasNewDemographics({
    coreDemographics: originalDemographics,
    linkDemographics: augmentedDemographics,
  });
  return newDemographics.hasNewDemographics;
}

async function prepareAndTriggerPD({
  patient,
  facilityId,
  requestId,
  baseLogMessage,
  isRerunPdOnNewDemographics,
  isForceNewPdRun,
  isScheduledDq,
  forceDownload,
  isTargetedQuery,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  baseLogMessage: string;
  isRerunPdOnNewDemographics: boolean;
  isForceNewPdRun: boolean;
  isScheduledDq: boolean;
  forceDownload: boolean;
  isTargetedQuery: boolean;
}): Promise<void> {
  try {
    const pdRequest = await prepareForPatientDiscovery(
      patient,
      facilityId,
      requestId,
      isTargetedQuery
    );
    const numGateways = pdRequest.gateways.length;

    const { log } = out(`${baseLogMessage}, requestId: ${pdRequest.id}`);

    const pdStatePromise = createPatientStatePd({
      patientId: patient.id,
      cxId: patient.cxId,
      network: MedicalDataSource.EHEX,
      params: {
        requestId,
        facilityId,
        rerunPdOnNewDemographics: isRerunPdOnNewDemographics,
        isForceNewPdRun,
        totalGateways: numGateways,
        isTargetedQuery,
      },
    });

    const [pdResult, dqResult] = await Promise.allSettled([
      pdStatePromise,
      ...(isScheduledDq
        ? [
            createPatientStateDq({
              patientId: patient.id,
              cxId: patient.cxId,
              network: MedicalDataSource.EHEX,
              params: {
                requestId,
                facilityId,
                forceDownload,
                totalGateways: 0,
                totalDocuments: 0,
              },
            }),
          ]
        : []),
    ]);

    if (dqResult && dqResult.status === "rejected") {
      const msg = "Failed to schedule DQ";
      out(baseLogMessage).log(`${msg} - ${errorToString(dqResult.reason)}`);
      capture.error(msg, {
        extra: {
          patientId: patient.id,
          requestId,
          facilityId,
          error: errorToString(dqResult.reason),
        },
      });
    }

    if (pdResult.status === "rejected") {
      throw new MetriportError("Failed to create PD state", pdResult.reason, {
        patientId: patient.id,
        requestId,
        facilityId,
        error: errorToString(pdResult.reason),
      });
    }

    if (numGateways > 0) {
      log(
        `Kicking off PD - ${numGateways} gateways, ${
          isTargetedQuery ? "Targeted Query" : "Grouped Query"
        }`
      );
      const ehexGateway = makeEhexGateway();
      await ehexGateway.startPatientDiscovery({
        pdRequest,
        patientId: patient.id,
        cxId: patient.cxId,
      });
    }
  } catch (error) {
    // TODO: 1665 - What did this use to do?
    // await resetScheduledPatientDiscovery({
    //   patient,
    //   source: MedicalDataSource.EHEX,
    // });
    await failPatientStatePd({
      patientId: patient.id,
      cxId: patient.cxId,
      network: MedicalDataSource.EHEX,
      requestId,
      reason: errorToString(error),
    });
    const msg = `Error on Patient Discovery`;
    out(baseLogMessage).log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        context,
        error: errorToString(error),
        isTargetedQuery,
      },
    });
  }
}

async function prepareForPatientDiscovery(
  patient: Patient,
  facilityId: string,
  requestId: string,
  isTargetedQuery: boolean
): Promise<OutboundPatientDiscoveryReq> {
  const patientResource = toEhexGatewayPatientResource(patient);

  const getGatewaysPromise = isTargetedQuery
    ? gatherXCPDGateways(patient)
    : getGroupedQueryGateways();
  const [v2Gateways, initiator] = await Promise.all([
    getGatewaysPromise,
    getEhexInitiator(patient, facilityId),
  ]);

  const pdRequestGatewayV2 = createOutboundPatientDiscoveryReq({
    patientResource,
    cxId: patient.cxId,
    patientId: patient.id,
    xcpdGateways: v2Gateways,
    requestId: requestId,
    initiator,
  });

  return pdRequestGatewayV2;
}

export async function remove(patient: Patient): Promise<void> {
  const { log } = out(`ehex.patient.remove - M patientId ${patient.id}`);
  log(`Deleting eHex data`);
  await deleteEhexPatientData({ id: patient.id, cxId: patient.cxId });
}
