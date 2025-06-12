import { SurescriptsSendPatientRequestHandler } from "./send-patient-request";

import { SurescriptsSftpClient } from "../../client";
import { SurescriptsApi } from "../../api";
import { SurescriptsPatientRequest } from "../../types";

export class SurescriptsSendPatientRequestHandlerDirect
  implements SurescriptsSendPatientRequestHandler
{
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async sendPatientRequest(request: SurescriptsPatientRequest): Promise<void> {
    const api = new SurescriptsApi();
    const requestData = await api.getPatientRequestData(request);
    await this.client.sendPatientRequest(requestData);
  }
}
