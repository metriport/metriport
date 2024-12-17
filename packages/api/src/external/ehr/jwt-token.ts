import z from "zod";
import { JwtTokenSource, JwtTokenData } from "../../domain/jwt-token";
import { getJwtToken, findOrCreateJwtToken } from "../../command/jwt-token";

export const createJwtSchema = z.object({
  exp: z.number(),
  data: z.custom<JwtTokenData>(),
});
export type CreateJwt = z.infer<typeof createJwtSchema>;

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
  data,
}: {
  token: string;
  source: JwtTokenSource;
  data: CreateJwt;
}): Promise<void> {
  await findOrCreateJwtToken({
    token,
    exp: new Date(data.exp),
    source,
    data: data.data,
  });
}
