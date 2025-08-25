import * as dotenv from "dotenv";
dotenv.config({ path: ".env._cw_org_migration" });
// keep that ^ on top
import { APIMode, CommonWellMember } from "@metriport/commonwell-sdk-v1";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";

export function makeCommonWellMemberAPI(mode: APIMode) {
  return new CommonWellMember({
    orgCert: getEnvVarOrFail("CW_MEMBER_CERTIFICATE"),
    rsaPrivateKey: getEnvVarOrFail("CW_MEMBER_PRIVATE_KEY"),
    memberName: getEnvVarOrFail("CW_MEMBER_NAME"),
    memberId: getEnvVarOrFail("CW_MEMBER_ID"),
    apiMode: mode,
  });
}
