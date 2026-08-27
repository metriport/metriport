import { getCanvasEnv } from "@metriport/core/external/ehr/canvas/environment";
import CanvasApi, { CanvasEnv } from "@metriport/core/external/ehr/canvas/index";
import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";
import {
  canvasClientSource,
  canvasPluginSource,
} from "@metriport/shared/interface/external/ehr/canvas/jwt-token";
import { getLatestExpiringJwtTokenBySourceAndData } from "../../../command/jwt-token";
import { createEhrClientWithClientCredentials } from "../shared/utils/client";

async function getPluginToken({
  cxId,
  practiceId,
}: EhrPerPracticeParams): Promise<string | undefined> {
  const data = { cxId, practiceId, source: canvasPluginSource };
  const token = await getLatestExpiringJwtTokenBySourceAndData({
    source: canvasPluginSource,
    data,
  });
  return token?.token;
}

export async function createCanvasClientWithTokenIdAndEnvironment(
  perPracticeParams: EhrPerPracticeParams
): Promise<{ client: CanvasApi; tokenId: string; environment: CanvasEnv }> {
  const pluginToken = await getPluginToken(perPracticeParams);
  return await createEhrClientWithClientCredentials<CanvasEnv, CanvasApi, EhrPerPracticeParams>({
    ...perPracticeParams,
    source: canvasClientSource,
    getEnv: { params: perPracticeParams, getEnv: getCanvasEnv },
    getClient: params => CanvasApi.create({ ...params, pluginToken }),
  });
}

export async function createCanvasClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<CanvasApi> {
  const { client } = await createCanvasClientWithTokenIdAndEnvironment(perPracticeParams);
  return client;
}
