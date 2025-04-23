import { sleep } from "@metriport/shared";
import { linkPatient } from "../../api/elation/link-patient";
import { ElationLinkPatientHandler, ProcessLinkPatientRequest } from "./elation-link-patient";

export class ElationLinkPatientLocal implements ElationLinkPatientHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async processLinkPatient({
    cxId,
    practiceId,
    patientId,
  }: ProcessLinkPatientRequest): Promise<void> {
    await linkPatient({
      cxId,
      practiceId,
      patientId,
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
