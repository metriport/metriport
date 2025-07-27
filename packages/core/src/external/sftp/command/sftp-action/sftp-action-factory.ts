import { Config } from "../../../../util/config";
import { SftpClient } from "../../client";
import { SftpActionHandler } from "./sftp-action";
import { SftpActionDirect } from "./sftp-action-direct";

export function sftpActionHandlerBuilder(client: SftpClient): () => SftpActionHandler {
  return function () {
    // Lambda has direct execution access since it lives within the VPC for direct SFTP actions
    if (Config.isSftpActionLambda()) {
      return new SftpActionDirect(client);
    }
    return new SftpActionDirect(client);
  };
}
