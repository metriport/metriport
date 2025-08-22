import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { createAthenaHealthClient } from "../athenahealth/shared";
import { createCanvasClient } from "../canvas/shared";
import { createElationHealthClient } from "../elation/shared";
import { EhrClientWithClientCredentials } from "../environment";

export type GetClientTokenInfoRequest = {
  cxId: string;
  practiceId: string;
  tokenId?: string;
  tokenInfo?: JwtTokenInfo;
};

export async function getClientTokenInfo({
  ehr,
  ...params
}: GetClientTokenInfoRequest & { ehr: EhrSource }): Promise<JwtTokenInfo | undefined> {
  const handler = getEhrGetClientTokenInfoHandler(ehr);
  const client = await handler({ ...params });
  return client.getTwoLeggedAuthTokenInfo();
}

export type GetClientTokenInfoClientRequest = Omit<GetClientTokenInfoRequest, "ehr">;

type GetClientFn = (
  params: GetClientTokenInfoClientRequest
) => Promise<EhrClientWithClientCredentials>;

type GetClientTokenInfoFnMap = Record<EhrSource, GetClientFn | undefined>;

const ehrGetClientTokenInfoMap: GetClientTokenInfoFnMap = {
  [EhrSources.canvas]: createCanvasClient,
  [EhrSources.athena]: createAthenaHealthClient,
  [EhrSources.elation]: createElationHealthClient,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrGetClientTokenInfoHandler(ehr: EhrSource): GetClientFn {
  const handler = ehrGetClientTokenInfoMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to create EHR client", undefined, {
      ehr,
    });
  }
  return handler;
}
