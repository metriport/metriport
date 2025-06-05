import { sleep } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { linkPatient } from "../../../api/link-patient";
import { ElationLinkPatientHandler, ProcessLinkPatientRequest } from "./elation-link-patient";

export class ElationLinkPatientLocal implements ElationLinkPatientHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async processLinkPatient({
    cxId,
    practiceId,
    patientId,
  }: ProcessLinkPatientRequest): Promise<void> {
    await linkPatient({
      ehr: EhrSources.elation,
      cxId,
      practiceId,
      patientId,
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
