import z from "zod";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { getJwtToken, createJwtToken } from "../../command/jwt/jwt-token";

const createJwtSchema = z.object({
  exp: z.number(),
  data: z.record(z.string(), z.string()),
});

export async function checkJwtToken(source: string, req: Request, res: Response) {
  const accessToken = getAccessToken(req);
  const authInfo = await getJwtToken({
    token: accessToken,
    source,
  });
  if (authInfo) {
    const expiresAt = new Date(authInfo.exp).getTime();
    const now = new Date().getTime();
    if (expiresAt >= now) {
      return res.status(httpStatus.OK).json({ active: true });
    }
  }
  return res.status(httpStatus.OK).json({ active: false });
}

export async function saveJwtToken(source: string, req: Request, res: Response) {
  const accessToken = getAccessToken(req);
  const createJwtData = createJwtSchema.parse(req.body);
  await createJwtToken({
    token: accessToken,
    exp: createJwtData.exp,
    source,
    data: createJwtData.data,
  });
  return res.sendStatus(httpStatus.OK);
}

export function getAccessToken(req: Request): string {
  const accessToken = req.header("Authorization");
  if (!accessToken) throw new Error("Missing Authorization Header");
  return accessToken;
}
