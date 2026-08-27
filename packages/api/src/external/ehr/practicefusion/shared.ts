import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";
import { getPracticeFusionEnv } from "@metriport/core/external/ehr/practicefusion/environment";
import PracticeFusionApi, {
  PracticeFusionEnv,
} from "@metriport/core/external/ehr/practicefusion/index";
import { MetriportError } from "@metriport/shared";
import {
  practicefusionRefreshJwtTokenDataSchema,
  practicefusionRefreshSource,
} from "@metriport/shared/interface/external/ehr/practicefusion/jwt-token";
import { getLatestExpiringJwtTokenBySourceAndPartialData } from "../../../command/jwt-token";

export async function createPracticeFusionClientWithTokenIdAndEnvironment(
  perPracticeParams: EhrPerPracticeParams
): Promise<{ client: PracticeFusionApi; tokenId: string; environment: PracticeFusionEnv }> {
  const { cxId, practiceId } = perPracticeParams;
  const storedToken = await getLatestExpiringJwtTokenBySourceAndPartialData({
    source: practicefusionRefreshSource,
    data: { practiceId },
  });
  if (!storedToken) {
    throw new MetriportError(
      "PracticeFusion no token found, user must authorize first from UI",
      undefined,
      { practiceId }
    );
  }
  const parseResult = practicefusionRefreshJwtTokenDataSchema.safeParse(storedToken.data);
  if (!parseResult.success) {
    throw new MetriportError("PracticeFusion token data is invalid", undefined, {
      practiceId,
      tokenId: storedToken.id,
    });
  }
  const { refreshToken } = parseResult.data;
  const envCredentials = getPracticeFusionEnv({ cxId, practiceId });
  const client = await PracticeFusionApi.create({
    practiceId,
    twoLeggedAuthTokenInfo: {
      access_token: storedToken.token,
      exp: storedToken.exp,
      id: storedToken.id,
    },
    refreshToken,
    ...envCredentials,
  });
  return {
    client,
    tokenId: storedToken.id,
    environment: envCredentials.environment,
  };
}

export async function createPracticeFusionClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<PracticeFusionApi> {
  const { client } = await createPracticeFusionClientWithTokenIdAndEnvironment(perPracticeParams);
  return client;
}
