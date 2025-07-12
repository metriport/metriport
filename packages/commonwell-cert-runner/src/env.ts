import { getEnv, getEnvOrFail } from "./util";

export const memberId = getEnvOrFail("CW_MEMBER_ID");
export const memberOID = getEnvOrFail("CW_MEMBER_OID");
export const memberName = getEnvOrFail("CW_MEMBER_NAME");
export const memberCertificateString = getEnvOrFail("CW_MEMBER_CERTIFICATE");
export const memberPrivateKeyString = getEnvOrFail("CW_MEMBER_PRIVATE_KEY");

export const orgCertificateString = getEnvOrFail("CW_ORG_CERTIFICATE");
export const orgPrivateKeyString = getEnvOrFail("CW_ORG_PRIVATE_KEY");
export const orgGatewayEndpoint = getEnvOrFail("CW_ORG_GATEWAY_ENDPOINT");
export const orgGatewayAuthorizationServerEndpoint = getEnvOrFail(
  "CW_ORG_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT"
);
export const orgGatewayAuthorizationClientId = getEnvOrFail(
  "CW_ORG_GATEWAY_AUTHORIZATION_CLIENT_ID"
);
export const orgGatewayAuthorizationClientSecret = getEnvOrFail(
  "CW_ORG_GATEWAY_AUTHORIZATION_CLIENT_SECRET"
);
/** If set, the cert runner will use this org and not try to create a new one. */
export const existingOrgId = getEnv("CW_ORG_ID");
