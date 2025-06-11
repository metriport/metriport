import { getCanvasEnv } from "@metriport/core/external/ehr/canvas/environment";
import CanvasApi, { CanvasEnv } from "@metriport/core/external/ehr/canvas/index";
import { EhrPerPracticeParams } from "@metriport/core/external/ehr/environment";
import { canvasClientSource } from "@metriport/shared/interface/external/ehr/canvas/jwt-token";
import { createEhrClientWithClientCredentials } from "../shared/utils/client";

export async function createCanvasClientWithTokenIdAndEnvironment(
  perPracticeParams: EhrPerPracticeParams
): Promise<{ client: CanvasApi; tokenId: string; environment: CanvasEnv }> {
  return await createEhrClientWithClientCredentials<CanvasEnv, CanvasApi, EhrPerPracticeParams>({
    ...perPracticeParams,
    source: canvasClientSource,
    getEnv: { params: perPracticeParams, getEnv: getCanvasEnv },
    getClient: CanvasApi.create,
  });
}

export async function createCanvasClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<CanvasApi> {
  const { client } = await createCanvasClientWithTokenIdAndEnvironment(perPracticeParams);
  return client;
}
