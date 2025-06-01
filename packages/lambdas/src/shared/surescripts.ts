import { Config } from "@metriport/core/util/config";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";

export async function getSurescriptSecrets() {
  const [surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword] =
    await Promise.all([
      getSecretValue("SurescriptsPublicKey", Config.getAWSRegion()),
      getSecretValue("SurescriptsPrivateKey", Config.getAWSRegion()),
      getSecretValue("SurescriptsSenderPassword", Config.getAWSRegion()),
    ]);
  if (!surescriptsPublicKey) throw new Error("Missing surescripts public key");
  if (!surescriptsPrivateKey) throw new Error("Missing surescripts private key");
  if (!surescriptsSenderPassword) throw new Error("Missing surescripts sender password");
  return { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword };
}
