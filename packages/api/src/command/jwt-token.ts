import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../errors/not-found";
import { JwtTokenModel } from "../models/jwt-token";
import { JwtToken } from "../domain/jwt-token";

export type JwtTokenParams = {
  token: string;
  exp: Date;
  source: string;
  data: object;
};

export type JwtTokenLookUpParam = Omit<JwtTokenParams, "exp" | "data">;

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
}: JwtTokenLookUpParam): Promise<JwtToken | undefined> {
  const existing = await JwtTokenModel.findOne({
    where: { token, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

/**
 * DOES NOT CHECK EXPIRATION
 */
export async function getJwtTokenOrFail({ token, source }: JwtTokenLookUpParam): Promise<JwtToken> {
  const jwtToken = await getJwtToken({
    token,
    source,
  });
  if (!jwtToken) throw new NotFoundError("JwtToken not found", undefined, { token, source });
  return jwtToken;
}

export async function deleteJwtToken({ token, source }: JwtTokenLookUpParam): Promise<void> {
  const existing = await JwtTokenModel.findOne({
    where: { token, source },
  });
  if (!existing) throw new NotFoundError("Entry not found", undefined, { token, source });
  await existing.destroy();
}
