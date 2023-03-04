import { APIMode, CommonWell, PurposeOfUse, RequestMetadata } from "@metriport/commonwell-sdk";
import { Config, getEnvVarOrFail } from "../../shared/config";

// TODO move this to Config
const metriportOrgName = getEnvVarOrFail("CW_ORG_NAME");
const metriportSandboxOrgName = getEnvVarOrFail("SANDBOX_CW_ORG_NAME");

const metriportSandboxOID = getEnvVarOrFail("SANDBOX_SYSTEM_ROOT_OID");
const metriportOID = getEnvVarOrFail("SYSTEM_ROOT_OID");
const metriportPrivateKey = getEnvVarOrFail("CW_PRIVATE_KEY");
const metriportCert = getEnvVarOrFail("CW_CERTIFICATE");

const memberManagementPrivateKey = getEnvVarOrFail("CW_MEMBER_PRIVATE_KEY");
const memberManagementCert = getEnvVarOrFail("CW_MEMBER_CERTIFICATE");
const memberManagementOID = getEnvVarOrFail("CW_MEMBER_OID");

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;
export const apiUrl = Config.isProdEnv()
  ? Config.getCWProductionUrl()
  : Config.getCWProductionUrl();

export const CW_ID_PREFIX = "urn:oid:";
export const CW_ID_URL_ENCODED_PREFIX = `%5E%5E%5Eurn%3aoid%3a`;

export const commonWell = new CommonWell(
  metriportCert,
  metriportPrivateKey,
  metriportOrgName,
  metriportOID,
  apiMode
);
export const commonWellSandbox = new CommonWell(
  metriportCert,
  metriportPrivateKey,
  metriportSandboxOrgName,
  metriportSandboxOID,
  APIMode.integration
);

export const commonWellMember = new CommonWell(
  memberManagementCert,
  memberManagementPrivateKey,
  metriportOrgName,
  memberManagementOID,
  apiMode
);

const baseQueryMeta = (orgName: string) => ({
  purposeOfUse: PurposeOfUse.TREATMENT,
  role: "ict",
  subjectId: `${orgName} System User`,
});

export type OrgRequestMetadataCreate = Omit<
  RequestMetadata,
  "npi" | "role" | "purposeOfUse" | "subjectId"
> &
  Required<Pick<RequestMetadata, "npi">> &
  Partial<Pick<RequestMetadata, "role" | "purposeOfUse">>;

export function organizationQueryMeta(
  orgName: string,
  meta: OrgRequestMetadataCreate
): RequestMetadata {
  const base = baseQueryMeta(orgName);
  return {
    subjectId: base.subjectId,
    role: meta.role ?? base.role,
    purposeOfUse: meta.purposeOfUse ?? base.purposeOfUse,
    npi: meta.npi,
  };
}

export const metriportQueryMeta: RequestMetadata = baseQueryMeta("Metriport");
