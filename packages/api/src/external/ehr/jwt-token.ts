import z from "zod";
import { getJwtToken, findOrCreateJwtToken } from "../../command/jwt-token";

export const createJwtSchema = z.object({
  exp: z.number(),
  data: z.record(z.string(), z.string()),
});
export type CreateJwt = z.infer<typeof createJwtSchema>;

export async function checkJwtToken({
  token,
  source,
}: {
  token: string;
  source: string;
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
  source: string;
  data: CreateJwt;
}): Promise<void> {
  await findOrCreateJwtToken({
    token,
    exp: new Date(data.exp),
    source,
    data: data.data,
  });
}
