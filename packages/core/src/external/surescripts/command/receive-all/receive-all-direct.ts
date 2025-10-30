import { SurescriptsSftpClient } from "../../client";
import { SurescriptsReceiveAllHandler } from "./receive-all";
import { SurescriptsReceiveAllRequest, SurescriptsSftpFile } from "../../types";

export class SurescriptsReceiveAllHandlerDirect implements SurescriptsReceiveAllHandler {
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async receiveAllNewResponses({
    maxResponses,
  }: SurescriptsReceiveAllRequest): Promise<SurescriptsSftpFile[]> {
    const responses = await this.client.receiveAllNewResponses({ maxResponses });
    return responses;
  }
}
