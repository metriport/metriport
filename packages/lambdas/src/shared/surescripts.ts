import { Config } from "@metriport/core/util/config";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { BadRequestError } from "@metriport/shared";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";

export async function makeSurescriptsClient() {
  const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
    await getSurescriptSecrets();
  return new SurescriptsSftpClient({
    publicKey: surescriptsPublicKey,
    privateKey: surescriptsPrivateKey,
    senderPassword: surescriptsSenderPassword,
    logLevel: "info",
  });
}

export async function getSurescriptSecrets() {
  const [surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword] =
    await Promise.all([
      getSecretValue("SurescriptsPublicKey", Config.getAWSRegion()),
      getSecretValue("SurescriptsPrivateKey", Config.getAWSRegion()),
      getSecretValue("SurescriptsSenderPassword", Config.getAWSRegion()),
    ]);
  if (!surescriptsPublicKey) throw new BadRequestError("Missing surescripts public key");
  if (!surescriptsPrivateKey) throw new BadRequestError("Missing surescripts private key");
  if (!surescriptsSenderPassword) throw new BadRequestError("Missing surescripts sender password");
  return { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword };
}
