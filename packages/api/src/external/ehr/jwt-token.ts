import { JwtTokenSource, JwtTokenData } from "../../domain/jwt-token";
import { getJwtToken, findOrCreateJwtToken } from "../../command/jwt-token";

export async function checkJwtToken({
  token,
  source,
}: {
  token: string;
  source: JwtTokenSource;
}): Promise<{ active: boolean; expired?: boolean }> {
  const authInfo = await getJwtToken({
    token,
    source,
  });
  if (!authInfo) return { active: false };
  if (authInfo.exp < new Date()) return { active: false, expired: true };
  return { active: true };
}

export async function saveJwtToken({
  token,
  source,
  exp,
  data,
}: {
  token: string;
  source: JwtTokenSource;
  exp: number;
  data: JwtTokenData;
}): Promise<void> {
  await findOrCreateJwtToken({
    token,
    exp: new Date(exp),
    source,
    data,
  });
}
