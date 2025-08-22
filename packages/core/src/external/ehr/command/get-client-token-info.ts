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
  const handler = getEhrCreateClientHandler(ehr);
  const client = await handler({ ...params });
  return client.getTwoLeggedAuthTokenInfo();
}

export type GetClientTokenInfoClientRequest = Omit<GetClientTokenInfoRequest, "ehr">;

type CreateClientFn = (
  params: GetClientTokenInfoClientRequest
) => Promise<EhrClientWithClientCredentials>;

type CreateClientFnMap = Record<EhrSource, CreateClientFn | undefined>;

const ehrCreateClientMap: CreateClientFnMap = {
  [EhrSources.canvas]: createCanvasClient,
  [EhrSources.athena]: createAthenaHealthClient,
  [EhrSources.elation]: createElationHealthClient,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrCreateClientHandler(ehr: EhrSource): CreateClientFn {
  const handler = ehrCreateClientMap[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to create EHR client", undefined, {
      ehr,
    });
  }
  return handler;
}
