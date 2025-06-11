import { Config } from "../../../util/config";
import { SftpClient } from "../client";
import { SftpAction } from "../types";
import { SftpActionHandler } from "./sftp-action";
import { SftpActionLocal } from "./sftp-action-local";
import { SftpActionCloud } from "./sftp-action-cloud";

export function buildSftpActionHandler<A extends SftpAction>(
  client: SftpClient,
  sftpActionLambdaName: string
): SftpActionHandler<A> {
  if (Config.isDev()) {
    return new SftpActionLocal(client);
  }
  return new SftpActionCloud(sftpActionLambdaName);
}
