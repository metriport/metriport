import { QuestRequestPatientHandler } from "./request-patient";
import { QuestPatientRequest, QuestPatientStatus } from "../../types";
import { setPatientSetting } from "../../api/patient-setting";

export class QuestRequestPatientDirect implements QuestRequestPatientHandler {
  async requestPatient(requestData: QuestPatientRequest): Promise<QuestPatientStatus> {
    await setPatientSetting(requestData);
    return {
      backfill: requestData.backfill,
      notifications: requestData.notifications,
    };
  }
}
