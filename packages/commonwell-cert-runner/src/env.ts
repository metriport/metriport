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

export const commonwellSandboxOID = getEnvOrFail("CW_SANDBOX_ORG_OID");
export const commonwellSandboxOrgName = getEnvOrFail("CW_SANDBOX_ORG_NAME");

export const orgIdSuffix = getEnvOrFail("DOCUMENT_CONTRIBUTION_ORGANIZATION_ID");
export const firstName = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_FIRST_NAME");
export const lastName = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_LAST_NAME");
export const dob = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_DATE_OF_BIRTH");
export const gender = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_GENDER");
export const zip = getEnv("DOCUMENT_CONTRIBUTION_PATIENT_ZIP");
export const fhirUrl = getEnvOrFail("DOCUMENT_CONTRIBUTION_FHIR_URL");
export const docUrl = getEnvOrFail("DOCUMENT_CONTRIBUTION_URL");

export const docPatientFirstName = getEnvOrFail("DOCUMENT_PATIENT_FIRST_NAME");
export const docPatientLastName = getEnvOrFail("DOCUMENT_PATIENT_LAST_NAME");
export const docPatientDateOfBirth = getEnvOrFail("DOCUMENT_PATIENT_DATE_OF_BIRTH");
export const docPatientGender = getEnvOrFail("DOCUMENT_PATIENT_GENDER");
export const docPatientZip = getEnvOrFail("DOCUMENT_PATIENT_ZIP");

export const docAuthUrl = getEnvOrFail("DOCUMENT_CONTRIBUTION_AUTH_URL");
export const clientId = getEnvOrFail("DOCUMENT_CONTRIBUTION_CLIENT_ID");
export const clientSecret = getEnvOrFail("DOCUMENT_CONTRIBUTION_CLIENT_SECRET");
