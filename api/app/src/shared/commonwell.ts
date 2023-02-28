import { CommonWell, APIMode, PurposeOfUse, RequestMetadata } from "@metriport/commonwell-sdk";
import { getEnvVarOrFail, Config } from "./config";

const commonwellPrivateKey = getEnvVarOrFail("COMMONWELL_MEMBER_PRIVATE_KEY");
const commonwellCert = getEnvVarOrFail("COMMONWELL_MEMBER_CERTIFICATE");
const commonwellMemberOID = getEnvVarOrFail("COMMONWELL_MEMBER_OID");
const commonwellOrgName = getEnvVarOrFail("COMMONWELL_ORG_NAME");

const apiMode = Config.isProdEnv() ? APIMode.production : APIMode.integration;

export const CW_ID_PREFIX = "urn:oid:";
export const commonWellMember = new CommonWell(
  commonwellCert,
  commonwellPrivateKey,
  commonwellOrgName,
  commonwellMemberOID,
  apiMode
);

export const queryMeta: RequestMetadata = {
  purposeOfUse: PurposeOfUse.TREATMENT,
  role: "ict",
  subjectId: "Metriport System User",
};
