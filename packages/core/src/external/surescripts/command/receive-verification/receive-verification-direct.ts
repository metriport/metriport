import { SurescriptsReceiveVerificationHandler } from "./receive-verification";
import { SurescriptsSftpClient } from "../../client";

export class SurescriptsReceiveVerificationHandlerDirect
  implements SurescriptsReceiveVerificationHandler
{
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async receiveVerification({ transmissionId }: { transmissionId: string }): Promise<void> {
    await this.client.receiveVerificationResponse(transmissionId);
  }
}
