import { Config } from "../../../../util/config";
import { SftpClient } from "../../client";
import { SftpActionHandler } from "./sftp-action";
import { SftpActionCloud } from "./sftp-action-cloud";
import { SftpActionDirect } from "./sftp-action-direct";

export function sftpActionHandlerBuilder(
  client: SftpClient,
  sftpActionLambdaName: string
): () => SftpActionHandler {
  return function () {
    // Lambda has direct execution access since it lives within the VPC for direct SFTP actions
    if (Config.getSftpActionLambda()) {
      return new SftpActionDirect(client);
    }
    return new SftpActionCloud(sftpActionLambdaName);
  };
}
