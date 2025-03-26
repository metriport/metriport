import { errorToString, sleep } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { syncPatient } from "../api/sync-patient";
import { EhrSyncPatientHandler, ProcessSyncPatientRequest } from "./ehr-sync-patient";

export class EhrSyncPatientLocal implements EhrSyncPatientHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async processSyncPatient({
    ehr,
    cxId,
    practiceId,
    patientId,
    triggerDq,
  }: ProcessSyncPatientRequest): Promise<void> {
    const { log } = out(
      `processSyncPatient.local - ehr ${ehr} cxId ${cxId} practiceId ${practiceId} patientId ${patientId}`
    );
    try {
      await syncPatient({
        ehr,
        cxId,
        practiceId,
        patientId,
        triggerDq,
      });

      if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
    } catch (error) {
      const msg = `Failure while processing sync patient @ Ehr`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          ehr,
          cxId,
          practiceId,
          patientId,
          triggerDq,
          context: "ehr-sync-patient-local.processSyncPatient",
          error,
        },
      });
      throw error;
    }
  }
}
