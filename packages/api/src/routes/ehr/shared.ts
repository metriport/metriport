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
    if (authInfo.exp >= new Date()) {
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
    exp: new Date(createJwtData.exp),
    source,
    data: createJwtData.data,
  });
  return res.sendStatus(httpStatus.OK);
}

export function getAccessToken(req: Request): string {
  const header = req.header("Authorization");
  if (!header) throw new Error("Missing Authorization Header");
  const accessToken = header.replace("Bearer ", "");
  if (accessToken === "") throw new Error("Empty Authorization Header");
  return accessToken;
}
