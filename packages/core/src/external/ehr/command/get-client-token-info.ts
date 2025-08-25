import { BadRequestError, JwtTokenInfo } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { createAthenaHealthClient } from "../athenahealth/shared";
import { createCanvasClient } from "../canvas/shared";
import { createElationHealthClient } from "../elation/shared";
import { EhrClientWithClientCredentials, EhrSourceWithClientCredentials } from "../environment";

export type GetClientTokenInfoRequest = {
  ehr: EhrSourceWithClientCredentials;
  tokenInfo?: JwtTokenInfo;
  cxId: string;
  practiceId: string;
};

export async function getClientTokenInfo({
  ehr,
  ...params
}: GetClientTokenInfoRequest): Promise<JwtTokenInfo | undefined> {
  const handler = getEhrGetClientTokenInfoHandler(ehr);
  const client = await handler({ ...params });
  return client.getTwoLeggedAuthTokenInfo();
}

export type GetClientTokenInfoClientRequest = Omit<GetClientTokenInfoRequest, "ehr">;

type GetClientFn = (
  params: GetClientTokenInfoClientRequest
) => Promise<EhrClientWithClientCredentials>;

type GetClientTokenInfoFnMap = Record<EhrSourceWithClientCredentials, GetClientFn | undefined>;

const ehrGetClientTokenInfoMap: GetClientTokenInfoFnMap = {
  [EhrSources.canvas]: createCanvasClient,
  [EhrSources.athena]: createAthenaHealthClient,
  [EhrSources.elation]: createElationHealthClient,
};

function getEhrGetClientTokenInfoHandler(ehr: EhrSourceWithClientCredentials): GetClientFn {
  const handler = ehrGetClientTokenInfoMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to create EHR client", undefined, {
      ehr,
    });
  }
  return handler;
}
