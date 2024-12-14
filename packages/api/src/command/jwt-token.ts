import { NotFoundError } from "@metriport/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { JwtTokenModel } from "../models/jwt-token";
import { JwtToken, JwtTokenData, JwtTokenPerSource, JwtTokenSource } from "../domain/jwt-token";

export type JwtTokenParams = JwtTokenPerSource;

export type JwtTokenLookUpParams = Omit<JwtTokenParams, "exp" | "data">;

export async function findOrCreateJwtToken({
  token,
  exp,
  source,
  data,
}: JwtTokenParams): Promise<JwtToken> {
  const existing = await getJwtToken({ token, source });
  if (existing) return existing;
  const created = await JwtTokenModel.create({ id: uuidv7(), token, exp, source, data });
  return created.dataValues;
}

/**
 * DOES NOT CHECK EXPIRATION
 */
export async function getJwtToken({
  token,
  source,
}: JwtTokenLookUpParams): Promise<JwtToken | undefined> {
  const existing = await JwtTokenModel.findOne({
    where: { token, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

/**
 * DOES NOT CHECK EXPIRATION
 */
export async function getJwtTokenOrFail({
  token,
  source,
}: JwtTokenLookUpParams): Promise<JwtToken> {
  const jwtToken = await getJwtToken({
    token,
    source,
  });
  if (!jwtToken) throw new NotFoundError("JwtToken not found", undefined, { token, source });
  return jwtToken;
}

/**
 * DOES NOT CHECK EXPIRATION
 */
export async function getLatestJwtTokenBySourceAndData({
  source,
  data,
}: {
  source: JwtTokenSource;
  data: JwtTokenData;
}): Promise<JwtToken | undefined> {
  const existing = await JwtTokenModel.findAll({
    where: { source, data },
    order: [["exp", "DESC"]],
  });
  const latest = existing[0];
  if (!latest) return undefined;
  return latest.dataValues;
}

export async function deleteJwtToken({ token, source }: JwtTokenLookUpParams): Promise<void> {
  const existing = await JwtTokenModel.findOne({
    where: { token, source },
  });
  if (!existing) throw new NotFoundError("Entry not found", undefined, { token, source });
  await existing.destroy();
}
