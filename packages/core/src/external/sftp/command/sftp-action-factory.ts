import { Config } from "../../../util/config";
import { MetriportError } from "@metriport/shared";
import { SftpClient } from "../client";
import { SftpAction } from "../types";
import { SftpActionHandler } from "./sftp-action";
import { SftpActionDirect } from "./sftp-action-direct";
import { SftpActionCloud } from "./sftp-action-cloud";

export function buildSftpActionHandler<A extends SftpAction>({
  client,
  lambdaName,
}: {
  client?: SftpClient;
  lambdaName?: string;
}): SftpActionHandler<A> {
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
