import { sleep } from "@metriport/shared";
import { syncPatient } from "../../api/sync-patient";
import { EhrSyncPatientHandler, ProcessSyncPatientRequest } from "./ehr-sync-patient";

export class EhrSyncPatientDirect implements EhrSyncPatientHandler {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async processSyncPatient({
    ehr,
    cxId,
    practiceId,
    departmentId,
    patientId,
    triggerDq,
    isAppointment,
  }: ProcessSyncPatientRequest): Promise<void> {
    await syncPatient({
      ehr,
      cxId,
      practiceId,
      patientId,
      triggerDq,
      ...(departmentId ? { departmentId } : {}),
      ...(isAppointment ? { isAppointment } : {}),
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
