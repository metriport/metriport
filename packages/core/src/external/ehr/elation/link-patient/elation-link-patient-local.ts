import { errorToString, sleep } from "@metriport/shared";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { linkPatient } from "../../api/elation/link-patient";
import { ElationLinkPatientHandler, ProcessLinkPatientRequest } from "./elation-link-patient";

export class ElationLinkPatientLocal implements ElationLinkPatientHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async processLinkPatient({
    cxId,
    practiceId,
    patientId,
  }: ProcessLinkPatientRequest): Promise<void> {
    const { log } = out(
      `processLinkPatient.local - cxId ${cxId} practiceId ${practiceId} patientId ${patientId}`
    );
    try {
      await linkPatient({
        cxId,
        practiceId,
        patientId,
      });

      if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
    } catch (error) {
      const msg = `Failure while processing link patient @ Elation`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          cxId,
          practiceId,
          patientId,
          context: "elation-link-patient-local.processLinkPatient",
          error,
        },
      });
      throw error;
    }
  }
}
