import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { QuestSftpClient } from "@metriport/core/external/quest/client";
import { Config } from "@metriport/core/util/config";
import { BadRequestError } from "@metriport/shared";

export async function buildQuestClient(questSftpPasswordName: string): Promise<QuestSftpClient> {
  const { questSftpPassword } = await getQuestSecrets(questSftpPasswordName);
  return new QuestSftpClient({
    password: questSftpPassword,
    logLevel: "info",
  });
}

export async function getQuestSecrets(questSftpPasswordName: string): Promise<{
  questSftpPassword: string;
}> {
  const region = Config.getAWSRegion();
  const questSftpPassword = await getSecretValue(questSftpPasswordName, region);
  if (!questSftpPassword) throw new BadRequestError("Missing quest sftp password");
  return { questSftpPassword };
}
