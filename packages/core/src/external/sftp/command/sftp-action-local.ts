import { SftpActionHandler } from "./sftp-action";
import { SftpAction, SftpActionResult } from "../types";
import { SftpClient } from "../client";

export class SftpActionLocal<A extends SftpAction> implements SftpActionHandler<A> {
  constructor(private readonly client: SftpClient) {}

  async executeAction(action: A): Promise<{ result?: SftpActionResult<A>; error?: Error }> {
    try {
      await this.client.connect();
      const result = await this.client.execute(action);
      return { result };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    } finally {
      await this.client.disconnect();
    }
  }
}
