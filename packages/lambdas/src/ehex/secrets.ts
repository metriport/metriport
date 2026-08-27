import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { SamlCertsAndKeys } from "@metriport/core/external/carequality/ihe-gateway-v2/saml/security/types";
import { Config } from "@metriport/core/util/config";

export async function getEhexSamlCertsAndKeys(): Promise<SamlCertsAndKeys> {
  const privateKeySecretName = Config.getEhexOrgPrivateKey();
  const privateKeyPasswordSecretName = Config.getEhexOrgPrivateKeyPassword();
  const publicCertSecretName = Config.getEhexOrgCertificate();
  const certChainSecretName = Config.getEhexOrgCertificateIntermediate();

  const [privateKey, privateKeyPassword, publicCert, certChain] = await Promise.all([
    getSecret(privateKeySecretName),
    getSecret(privateKeyPasswordSecretName),
    getSecret(publicCertSecretName),
    getSecret(certChainSecretName),
  ]);
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
