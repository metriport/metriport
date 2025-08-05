import { MetriportError } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { SftpClient } from "../../client";
import { SftpActionHandler } from "./sftp-action";
import { SftpActionCloud } from "./sftp-action-cloud";
import { SftpActionDirect } from "./sftp-action-direct";

export function buildSftpActionHandler({
  client,
  lambdaName,
}: {
  client?: SftpClient;
  lambdaName?: string;
}): SftpActionHandler {
  if (Config.isDev() && client) {
    return new SftpActionDirect(client);
  } else if (lambdaName) {
    return new SftpActionCloud(lambdaName);
  } else {
    throw new MetriportError("No client or lambda name provided", undefined, {
      context: "sftp.command.sftp-action",
    });
  }
}
