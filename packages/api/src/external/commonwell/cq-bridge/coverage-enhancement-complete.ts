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
  startedAt,
  context,
}: {
  cxId: string;
  patientIds: string[];
  cqLinkStatus: CQLinkStatus;
  startedAt?: number;
  /**
   * Context/operation in which this function is being called
   */
  context?: string;
}): Promise<void> => {
  const startedAtLocal = Date.now();
  const { log } = out(`EC completer - cx ${cxId}, ctxt ${context ?? "n/a"}`);
  try {
    log(
      `Completing EC for ${patientIds.length} patients, to status: ${cqLinkStatus}, ` +
        `and triggering doc queries - patients: ${patientIds.join(", ")}`
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
  } finally {
    const duration = startedAt ? Date.now() - startedAt : undefined;
    const durationMin = duration ? dayjs.duration(duration).asMinutes() : undefined;
    const durationLocal = Date.now() - startedAtLocal;
    const durationLocalMin = dayjs.duration(durationLocal).asMinutes();
    log(
      `Done, total duration: ${duration} ms / ${durationMin} min ` +
        `(just to complete: ${durationLocal} ms / ${durationLocalMin} min)`
    );
  }
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

  const triggerDocRefs = new TriggerAndQueryDocRefsLocal();
  await triggerDocRefs.queryDocsForPatient({
    cxId: patient.cxId,
    patientId: patient.id,
    triggerWHNotificationsToCx,
  });
}
