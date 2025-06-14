import { Config } from "@metriport/core/util/config";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { BadRequestError } from "@metriport/shared";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";

export async function makeSurescriptsClient(): Promise<SurescriptsSftpClient> {
  const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
    await getSurescriptSecrets();
  return new SurescriptsSftpClient({
    publicKey: surescriptsPublicKey,
    privateKey: surescriptsPrivateKey,
    senderPassword: surescriptsSenderPassword,
    logLevel: "info",
  });
}

export async function getSurescriptSecrets(): Promise<{
  surescriptsPublicKey: string;
  surescriptsPrivateKey: string;
  surescriptsSenderPassword: string;
}> {
  const region = Config.getAWSRegion();
  const [surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword] =
    await Promise.all([
      getSecretValue("SurescriptsPublicKey", region),
      getSecretValue("SurescriptsPrivateKey", region),
      getSecretValue("SurescriptsSenderPassword", region),
    ]);
  if (!surescriptsPublicKey) throw new BadRequestError("Missing surescripts public key");
  if (!surescriptsPrivateKey) throw new BadRequestError("Missing surescripts private key");
  if (!surescriptsSenderPassword) throw new BadRequestError("Missing surescripts sender password");
  return { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword };
}
