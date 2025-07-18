import { SurescriptsSendPatientRequestHandler } from "./send-patient-request";

import { SurescriptsSftpClient } from "../../client";
import { SurescriptsDataMapper } from "../../data-mapper";
import { SurescriptsPatientRequest } from "../../types";

export class SurescriptsSendPatientRequestHandlerDirect
  implements SurescriptsSendPatientRequestHandler
{
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async sendPatientRequest(request: SurescriptsPatientRequest): Promise<void> {
    const dataMapper = new SurescriptsDataMapper();
    const requestData = await dataMapper.getPatientRequestData(request);
    await this.client.sendPatientRequest(requestData);
  }
}
