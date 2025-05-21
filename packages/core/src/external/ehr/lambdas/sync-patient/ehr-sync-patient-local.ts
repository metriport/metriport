import { sleep } from "@metriport/shared";
import { syncPatient } from "../../api/sync-patient";
import { EhrSyncPatientHandler, ProcessSyncPatientRequest } from "./ehr-sync-patient";

export class EhrSyncPatientLocal implements EhrSyncPatientHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async processSyncPatient({
    ehr,
    cxId,
    practiceId,
    departmentId,
    patientId,
    triggerDq,
  }: ProcessSyncPatientRequest): Promise<void> {
    await syncPatient({
      ehr,
      cxId,
      practiceId,
      patientId,
      triggerDq,
      ...(departmentId ? { departmentId } : {}),
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
