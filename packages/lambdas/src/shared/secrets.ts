import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { SamlCertsAndKeys } from "@metriport/core/external/carequality/ihe-gateway-v2/saml/security/types";
import { Config } from "@metriport/core/util/config";

export async function getSamlCertsAndKeys(): Promise<SamlCertsAndKeys> {
  const privateKeySecretName = Config.getCQOrgPrivateKey();
  const privateKeyPasswordSecretName = Config.getCQOrgPrivateKeyPassword();
  const publicCertSecretName = Config.getCQOrgCertificate();
  const certChainSecretName = Config.getCQOrgCertificateIntermediate();

  const privateKey = await getSecret(privateKeySecretName);
  const privateKeyPassword = await getSecret(privateKeyPasswordSecretName);
  const publicCert = await getSecret(publicCertSecretName);
  const certChain = await getSecret(certChainSecretName);
  if (
    !privateKey ||
    typeof privateKey !== "string" ||
    !privateKeyPassword ||
    typeof privateKeyPassword !== "string" ||
    !publicCert ||
    typeof publicCert !== "string" ||
    !certChain ||
    typeof certChain !== "string"
  ) {
    throw new Error("Failed to get secrets or one of the secrets is not a string.");
  }
  return {
    privateKey,
    privateKeyPassword,
    publicCert,
    certChain,
  };
}
