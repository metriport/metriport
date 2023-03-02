import { APIMode, CommonWell, PurposeOfUse, RequestMetadata } from "@metriport/commonwell-sdk";
import { Config, getEnvVarOrFail } from "../../shared/config";

// TODO move these getEnvVarOrFail to Config
const metriportOID = getEnvVarOrFail("SYSTEM_ROOT_OID");
const metriportOrgName = getEnvVarOrFail("CW_ORG_NAME");
const metriportPrivateKey = getEnvVarOrFail("CW_PRIVATE_KEY");
const metriportCert = getEnvVarOrFail("CW_CERTIFICATE");

const memberManagementOID = getEnvVarOrFail("CW_MEMBER_OID");
const memberManagementPrivateKey = getEnvVarOrFail("CW_MEMBER_PRIVATE_KEY");
const memberManagementCert = getEnvVarOrFail("CW_MEMBER_CERTIFICATE");

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;

export const CW_ID_PREFIX = "urn:oid:";

export const commonWell = new CommonWell(
  metriportCert,
  metriportPrivateKey,
  metriportOrgName,
  metriportOID,
  apiMode
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
