import { CommonWell, APIMode, PurposeOfUse, RequestMetadata } from "@metriport/commonwell-sdk";
import { getEnvVarOrFail, Config } from "../../shared/config";

// TODO move this to CW's folder, likely most of it to the api.ts file?

const commonwellPrivateKey = getEnvVarOrFail("CW_MEMBER_PRIVATE_KEY");
const commonwellCert = getEnvVarOrFail("CW_MEMBER_CERTIFICATE");
const commonwellMemberOID = getEnvVarOrFail("CW_MEMBER_OID");
const commonwellOrgName = getEnvVarOrFail("CW_ORG_NAME");

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;

export const CW_ID_PREFIX = "urn:oid:";
export const commonWellMember = new CommonWell(
  commonwellCert,
  commonwellPrivateKey,
  commonwellOrgName,
  commonwellMemberOID,
  apiMode
);

export const metriportQueryMeta: RequestMetadata = {
  purposeOfUse: PurposeOfUse.TREATMENT,
  role: "ict",
  subjectId: "Metriport System User",
};
