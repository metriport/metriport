import { getEnvVarOrFail } from "@metriport/shared";
import { OrgMemberInfo, User } from "@propelauth/express";
import { initBaseAuth } from "@propelauth/node";

export const auth = initBaseAuth({
  authUrl: getEnvVarOrFail("PROPELAUTH_AUTH_URL"),
  apiKey: getEnvVarOrFail("PROPELAUTH_API_KEY"),
});

export function getCxId(user: User): string | undefined {
  const userAtOrg = getOrgMemberInfo(user);
  if (!userAtOrg) return undefined;
  return userAtOrg.orgMetadata?.cxId as string | undefined;
}

export function getRole(user: User): string | undefined {
  const userAtOrg = getOrgMemberInfo(user);
  if (!userAtOrg) return undefined;
  return userAtOrg.assignedRole;
}

export function getOrgMemberInfo(user: User): OrgMemberInfo | undefined {
  const userAtOrgs = user.orgIdToOrgMemberInfo;
  const orgId = userAtOrgs ? Object.keys(userAtOrgs)[0] : undefined;
  if (!orgId) return undefined;
  const userAtOrg = userAtOrgs?.[orgId];
  return userAtOrg;
}
