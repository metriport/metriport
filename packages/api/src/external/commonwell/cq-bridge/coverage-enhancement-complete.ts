import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { TriggerAndQueryDocRefsLocal } from "../../../command/medical/document/trigger-and-query-local";
import { Patient } from "../../../domain/medical/patient";
import { CQLinkStatus } from "../patient-shared";
import { setCQLinkStatus } from "./cq-link-status";

dayjs.extend(duration);

const PARALLEL_UPDATES = 25;
const triggerWHNotificationsToCx = true;

export const completeEnhancedCoverage = async ({
  cxId,
  patientIds,
  cqLinkStatus,
}: {
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
    if (cqLinkStatus === "linked") await finishEnhancedCoverage(patient, log);
  };

  await executeAsynchronously(patientIds, completeECForPatient, {
    numberOfParallelExecutions: PARALLEL_UPDATES,
  });
};

/**
 * Finish the enhanced coverage for the patient.
 */
async function finishEnhancedCoverage(patient: Patient, log = console.log): Promise<void> {
  const facilityId = patient.facilityIds[0];
  if (!facilityId) {
    log(`Patient ${patient.id} has no facility, skipping update...`);
    throw new MetriportError(`Patient ${patient.id} has no facility`);
  }

  const startedAt = Date.now();
  try {
    const triggerDocRefs = new TriggerAndQueryDocRefsLocal();
    await triggerDocRefs.queryDocsForPatient({
      cxId: patient.cxId,
      patientId: patient.id,
      triggerWHNotificationsToCx,
    });
  } finally {
    const duration = Date.now() - startedAt;
    const durationMin = dayjs.duration(duration).asMinutes();
    log(`Done DQ, duration: ${duration} ms / ${durationMin} min`);
  }
}
