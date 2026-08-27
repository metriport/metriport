import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import { embedDashSource } from "@metriport/shared/interface/external/ehr/embed/jwt-token";
import { findOrCreateJwtToken } from "../jwt-token";
import { findOrCreateCxMapping } from "../mapping/cx";

export type CreateEmbedTokenResult = { token: string };
export type CreateEmbedTokenParams = {
  cxId: string;
  expirationInSeconds: number;
};

export async function createEmbedToken({
  cxId,
  expirationInSeconds,
}: CreateEmbedTokenParams): Promise<CreateEmbedTokenResult> {
  await findOrCreateCxMapping({
    cxId,
    source: embedDashSource,
    externalId: cxId,
    secondaryMappings: {},
  });

  const token = uuidv7();
  const expDate = buildDayjs().add(expirationInSeconds, "seconds").toDate();

  await findOrCreateJwtToken({
    token,
    exp: expDate,
    source: embedDashSource,
    data: { cxId, practiceId: cxId, source: embedDashSource },
  });

  return { token };
}
