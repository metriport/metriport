import { getEnvVar } from "@metriport/shared";
import { OrgMemberInfo, User } from "@propelauth/express";
import { initBaseAuth } from "@propelauth/node";

export type PropelAuth = ReturnType<typeof initBaseAuth>;

// TODO 1986 Move this back to getAuth() and make them required there - getAuth() doesn't return undefined anymore
const authUrl = getEnvVar("PROPELAUTH_AUTH_URL");
const apiKey = getEnvVar("PROPELAUTH_API_KEY");

let auth: PropelAuth | undefined;
export function getAuth(): PropelAuth | undefined {
  if (auth || !authUrl || !apiKey) return auth;
  auth = initBaseAuth({ authUrl, apiKey });
  return auth;
}

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
