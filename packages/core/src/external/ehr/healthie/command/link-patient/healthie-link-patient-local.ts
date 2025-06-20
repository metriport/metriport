import { sleep } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { linkPatient } from "../../../api/link-patient";
import { HealthieLinkPatientHandler, ProcessLinkPatientRequest } from "./healthie-link-patient";

export class HealthieLinkPatientLocal implements HealthieLinkPatientHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async processLinkPatient({
    cxId,
    practiceId,
    patientId,
  }: ProcessLinkPatientRequest): Promise<void> {
    await linkPatient({
      ehr: EhrSources.healthie,
      cxId,
      practiceId,
      patientId,
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
