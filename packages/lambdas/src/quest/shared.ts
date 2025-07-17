import { Config } from "@metriport/core/util/config";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { BadRequestError } from "@metriport/shared";
import { QuestSftpClient } from "@metriport/core/external/quest/client";

export async function buildQuestClient(): Promise<QuestSftpClient> {
  const { questSftpPassword } = await getQuestSecrets();
  return new QuestSftpClient({
    password: questSftpPassword,
    logLevel: "info",
  });
}

export async function getQuestSecrets(): Promise<{
  questSftpPassword: string;
}> {
  const region = Config.getAWSRegion();
  const [questSftpPassword] = await Promise.all([getSecretValue("QuestSftpPassword", region)]);
  if (!questSftpPassword) throw new BadRequestError("Missing quest sftp password");
  return { questSftpPassword };
}
