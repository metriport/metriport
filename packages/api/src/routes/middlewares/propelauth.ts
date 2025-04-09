import { out } from "@metriport/core/util";
import { getEnvVarOrFail } from "@metriport/shared";
import { OrgMemberInfo, User } from "@propelauth/express";
import { initBaseAuth } from "@propelauth/node";
import { Request } from "express";
import ForbiddenError from "../../errors/forbidden";

export type PropelAuth = ReturnType<typeof initBaseAuth>;

const authUrl = getEnvVarOrFail("PROPELAUTH_AUTH_URL");
const apiKey = getEnvVarOrFail("PROPELAUTH_API_KEY");
const publicKey = getEnvVarOrFail("PROPELAUTH_PUBLIC_KEY");

let auth: PropelAuth | undefined;
export function getAuth(): PropelAuth {
  if (auth) return auth;
  out("PropelAuth").log(
    `authUrl ${authUrl}, apiKey ${apiKey && apiKey.trim().length ? "***" : undefined}, publicKey ${
      publicKey && publicKey.trim().length ? "***" : undefined
    }`
  );
  auth = initBaseAuth({
    authUrl,
    apiKey,
    manualTokenVerificationMetadata: {
      verifierKey: publicKey,
      issuer: authUrl,
    },
  });
  return auth;
}

export async function getCxIdFromJwt(req: Request): Promise<string> {
  const auth = getAuth();

  const jwtStr = req.header("Authorization");
  if (!jwtStr) throw new ForbiddenError();

  const user = await auth.validateAccessTokenAndGetUser(jwtStr);

  const cxId = getCxId(user);
  if (!cxId) throw new ForbiddenError();

  return cxId;
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
