import { QuestSendPatientRequestHandler } from "./send-patient-request";

import { QuestSftpClient } from "../../client";
import { QuestDataMapper } from "../../data-mapper";
import { QuestPatientRequest } from "../../types";

export class QuestSendPatientRequestHandlerDirect implements QuestSendPatientRequestHandler {
  constructor(private readonly client: QuestSftpClient = new QuestSftpClient()) {}

  async sendPatientRequest(request: QuestPatientRequest): Promise<void> {
    const dataMapper = new QuestDataMapper();
    const requestData = await dataMapper.getPatientRequestData(request);
    await this.client.sendPatientRequest(requestData);
  }
}
