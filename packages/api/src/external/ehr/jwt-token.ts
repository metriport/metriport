import z from "zod";
import { EhrJwtTokenParams, EhrSource } from "./shared";
import { getJwtToken, findOrCreateJwtToken } from "../../command/jwt-token";

export const createJwtSchema = z.object({
  exp: z.number(),
  data: z.custom<Pick<EhrJwtTokenParams, "data">>(),
});
export type CreateJwt = z.infer<typeof createJwtSchema>;

export async function checkJwtToken({
  token,
  source,
}: {
  token: string;
  source: EhrSource;
}): Promise<{ active: boolean; expired?: boolean }> {
  const authInfo = await getJwtToken({
    token,
    source,
  });
  if (authInfo) {
    if (authInfo.exp >= new Date()) {
      return { active: true };
    }
    return { active: false, expired: true };
  }
  return { active: false };
}

export async function saveJwtToken({
  token,
  source,
  data,
}: {
  token: string;
  source: EhrSource;
  data: CreateJwt;
}): Promise<void> {
  await findOrCreateJwtToken({
    token,
    exp: new Date(data.exp),
    source,
    data: data.data,
  });
}
