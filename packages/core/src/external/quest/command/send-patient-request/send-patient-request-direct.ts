import { QuestSendPatientRequestHandler } from "./send-patient-request";

import { QuestSftpClient } from "../../client";
import { QuestDataMapper } from "../../data-mapper";
import { QuestJob, QuestPatientRequest } from "../../types";

export class QuestSendPatientRequestHandlerDirect implements QuestSendPatientRequestHandler {
  constructor(private readonly client: QuestSftpClient = new QuestSftpClient()) {}

  async sendPatientRequest(request: QuestPatientRequest): Promise<QuestJob> {
    const dataMapper = new QuestDataMapper();
    const requestData = await dataMapper.getPatientRequestData(request);
    return await this.client.sendPatientRequest(requestData);
  }
}
