import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { Config } from "@metriport/core/util/config";
import { BadRequestError } from "@metriport/shared";

export async function buildSurescriptsClient({
  surescriptsSftpPublicKeyName,
  surescriptsSftpPrivateKeyName,
  surescriptsSftpSenderPasswordName,
}: {
  surescriptsSftpPublicKeyName: string;
  surescriptsSftpPrivateKeyName: string;
  surescriptsSftpSenderPasswordName: string;
}): Promise<SurescriptsSftpClient> {
  const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
    await getSurescriptSecrets({
      surescriptsSftpPublicKeyName,
      surescriptsSftpPrivateKeyName,
      surescriptsSftpSenderPasswordName,
    });
  return new SurescriptsSftpClient({
    publicKey: surescriptsPublicKey,
    privateKey: surescriptsPrivateKey,
    senderPassword: surescriptsSenderPassword,
    logLevel: "info",
  });
}

export async function getSurescriptSecrets({
  surescriptsSftpPublicKeyName,
  surescriptsSftpPrivateKeyName,
  surescriptsSftpSenderPasswordName,
}: {
  surescriptsSftpPublicKeyName: string;
  surescriptsSftpPrivateKeyName: string;
  surescriptsSftpSenderPasswordName: string;
}): Promise<{
  surescriptsPublicKey: string;
  surescriptsPrivateKey: string;
  surescriptsSenderPassword: string;
}> {
  const region = Config.getAWSRegion();
  const [surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword] =
    await Promise.all([
      getSecretValue(surescriptsSftpPublicKeyName, region),
      getSecretValue(surescriptsSftpPrivateKeyName, region),
      getSecretValue(surescriptsSftpSenderPasswordName, region),
    ]);
  if (!surescriptsPublicKey) throw new BadRequestError("Missing surescripts public key");
  if (!surescriptsPrivateKey) throw new BadRequestError("Missing surescripts private key");
  if (!surescriptsSenderPassword) throw new BadRequestError("Missing surescripts sender password");
  return { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword };
}
