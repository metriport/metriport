import { getEnvVar, getEnvVarOrFail } from "@metriport/shared";

// export const rootOID = getEnvVarOrFail("ROOT_OID");
export const memberId = getEnvVarOrFail("CW_MEMBER_ID");
export const memberName = getEnvVarOrFail("CW_MEMBER_NAME");
export const memberCertificateString = getEnvVarOrFail("CW_MEMBER_CERTIFICATE");
export const memberPrivateKeyString = getEnvVarOrFail("CW_MEMBER_PRIVATE_KEY");

export const orgCertificateString = getEnvVarOrFail("CW_ORG_CERTIFICATE");
export const orgPrivateKeyString = getEnvVarOrFail("CW_ORG_PRIVATE_KEY");
export const orgGatewayEndpoint = getEnvVarOrFail("CW_ORG_GATEWAY_ENDPOINT");
export const orgGatewayAuthorizationServerEndpoint = getEnvVarOrFail(
  "CW_ORG_GATEWAY_AUTHORIZATION_SERVER_ENDPOINT"
);
export const orgGatewayAuthorizationClientId = getEnvVarOrFail(
  "CW_ORG_GATEWAY_AUTHORIZATION_CLIENT_ID"
);
export const orgGatewayAuthorizationClientSecret = getEnvVarOrFail(
  "CW_ORG_GATEWAY_AUTHORIZATION_CLIENT_SECRET"
);
/** If set, the cert runner will use this org and not try to create a new one. */
export const existingOrgOid = getEnvVar("CW_ORG_OID");
export const existingInitiatorOnlyOrgOid = getEnvVar("CW_INITIATOR_ONLY_ORG_OID");

export const contribExistingOrgOid = getEnvVar("CW_CONTRIB_ORG_OID");
export const contribServerUrl = getEnvVarOrFail("CONTRIB_SERVER_URL");
export const contribServerPort = parseInt(getEnvVarOrFail("CONTRIB_SERVER_PORT"));
