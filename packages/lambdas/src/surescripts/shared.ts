import { Config } from "@metriport/core/util/config";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getSecretValue } from "@metriport/core/external/aws/secret-manager";
import { BadRequestError } from "@metriport/shared";
import { SurescriptsSftpClient } from "@metriport/core/external/surescripts/client";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";

export async function makeSurescriptsClient(): Promise<SurescriptsSftpClient> {
  // Feature flags are required by the client to validate requesters
  FeatureFlags.init(Config.getAWSRegion(), Config.getFeatureFlagsTableName());

  const { surescriptsPublicKey, surescriptsPrivateKey, surescriptsSenderPassword } =
    await getSurescriptSecrets();
  return new SurescriptsSftpClient({
    publicKey: surescriptsPublicKey,
    privateKey: surescriptsPrivateKey,
    senderPassword: surescriptsSenderPassword,
    logLevel: "info",
  });
}

export function makeSurescriptsReplica(): SurescriptsReplica {
  return new SurescriptsReplica();
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
