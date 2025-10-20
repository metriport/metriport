import { SurescriptsVerifyRequestInHistoryHandler } from "./verify-request-in-history";
import { SurescriptsSftpClient } from "../../client";

export class SurescriptsVerifyRequestInHistoryHandlerDirect
  implements SurescriptsVerifyRequestInHistoryHandler
{
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async verifyRequestInHistory({ transmissionId }: { transmissionId: string }): Promise<void> {
    await this.client.verifyRequestInHistory(transmissionId);
  }
}
