import { SftpAction, SftpActionHandler, SftpActionResult } from "./sftp-action";
import { makeSftpListFilter, SftpClient } from "../../client";

export class SftpActionDirect<A extends SftpAction> implements SftpActionHandler<A> {
  constructor(private readonly client: SftpClient) {}

  async executeAction(action: A): Promise<{ result?: SftpActionResult<A>; error?: Error }> {
    try {
      return { result: await executeAction(this.client, action) };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

async function executeAction<A extends SftpAction>(
  client: SftpClient,
  action: A
): Promise<SftpActionResult<A>> {
  try {
    await client.connect();
    switch (action.type) {
      // Simply test if the connection is working
      case "connect":
        return true as SftpActionResult<A>;
      case "read":
        return (await client.read(action.remotePath, action)) as SftpActionResult<A>;
      case "write":
        return (await client.write(
          action.remotePath,
          action.content,
          action
        )) as SftpActionResult<A>;
      case "list":
        return (await client.list(
          action.remotePath,
          makeSftpListFilter({
            prefix: action.prefix,
            contains: action.contains,
          })
        )) as SftpActionResult<A>;
      case "exists":
        return (await client.exists(action.remotePath)) as SftpActionResult<A>;
    }
  } finally {
    await client.disconnect();
  }
}
