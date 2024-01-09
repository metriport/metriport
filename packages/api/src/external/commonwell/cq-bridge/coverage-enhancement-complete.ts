import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { TriggerAndQueryDocRefsLocal } from "../../../command/medical/document/trigger-and-query-local";
import { Patient } from "@metriport/core/domain/patient";
import { CQLinkStatus } from "../patient-shared";
import { setCQLinkStatus } from "./cq-link-status";
import { ECUpdaterLocal } from "./ec-updater-local";

dayjs.extend(duration);

const PARALLEL_UPDATES = 25;
const triggerWHNotificationsToCx = true;

const ecUpdater = new ECUpdaterLocal();

export const completeEnhancedCoverage = async ({
  ecId,
  cxId,
  patientIds,
  cqLinkStatus,
}: {
  ecId?: string;
  cxId: string;
  patientIds: string[];
  cqLinkStatus: CQLinkStatus;
}): Promise<void> => {
  const { log } = out(`EC completer - cx ${cxId}`);
  log(
    `Completing EC for ${patientIds.length} patients, to status: ${cqLinkStatus}, and triggering doc queries`
  );

  // Promise that will be executed for each patient
  const completeECForPatient = async (patientId: string): Promise<void> => {
    const { patient, updated } = await setCQLinkStatus({ cxId, patientId, cqLinkStatus });
    if (!updated) return; // if the status was already set don't do anything else
    if (cqLinkStatus === "linked") await finishEnhancedCoverage(ecId, patient, log);
  };

  await executeAsynchronously(patientIds, completeECForPatient, {
    numberOfParallelExecutions: PARALLEL_UPDATES,
  });
};

/**
 * Finish the enhanced coverage for the patient.
 */
async function finishEnhancedCoverage(
  ecId: string | undefined,
  patient: Patient,
  log = console.log
): Promise<void> {
  const facilityId = patient.facilityIds[0];
  if (!facilityId) {
    log(`Patient ${patient.id} has no facility, skipping update...`);
    throw new MetriportError(`Patient ${patient.id} has no facility`);
  }

  const startedAt = Date.now();
  try {
    const triggerDocRefs = new TriggerAndQueryDocRefsLocal();
    const { docsFound } = await triggerDocRefs.queryDocsForPatient({
      cxId: patient.cxId,
      patientId: patient.id,
      triggerWHNotificationsToCx,
    });
    ecId &&
      (await ecUpdater.storeECAfterDocQuery({
        ecId,
        cxId: patient.cxId,
        patientId: patient.id,
        docsFound,
      }));
  } finally {
    const duration = Date.now() - startedAt;
    const durationMin = dayjs.duration(duration).asMinutes();
    log(`Done DQ, duration: ${duration} ms / ${durationMin} min`);
  }
}
