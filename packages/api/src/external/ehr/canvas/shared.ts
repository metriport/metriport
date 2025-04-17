import CanvasApi, { CanvasEnv } from "@metriport/core/external/ehr/canvas/index";
import { cxClientKeyAndSecretMapSecretSchema, MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { createEhrClient, EhrEnvAndClientCredentials, EhrPerPracticeParams } from "../shared";

export const canvasClientJwtTokenSource = "canvas-client";
export const canvasWebhookJwtTokenSource = "canvas-webhook";

export function getCanvasEnv({
  cxId,
  practiceId,
}: EhrPerPracticeParams): EhrEnvAndClientCredentials<CanvasEnv> {
  const rawClientsMap = Config.getCanvasClientKeyAndSecretMap();
  if (!rawClientsMap) throw new Error("Canvas secrets map not set");
  const clientMap = cxClientKeyAndSecretMapSecretSchema.safeParse(JSON.parse(rawClientsMap));
  if (!clientMap.success) {
    throw new MetriportError("Canvas clients map has invalid format", undefined, {
      rawClientsMap: !Config.isProdEnv() ? rawClientsMap : undefined,
    });
  }
  const env = `${cxId}_${practiceId}_env`;
  const envEntry = clientMap.data[env];
  const key = `${cxId}_${practiceId}_key`;
  const keyEntry = clientMap.data[key];
  const secret = `${cxId}_${practiceId}_secret`;
  const secretEntry = clientMap.data[secret];
  if (!envEntry || !keyEntry || !secretEntry) {
    throw new MetriportError("Canvas credentials not found");
  }
  return {
    environment: envEntry,
    clientKey: keyEntry,
    clientSecret: secretEntry,
  };
}

export async function createCanvasClient(
  perPracticeParams: EhrPerPracticeParams
): Promise<CanvasApi> {
  return await createEhrClient<CanvasEnv, CanvasApi, EhrPerPracticeParams>({
    ...perPracticeParams,
    source: canvasClientJwtTokenSource,
    getEnv: { params: perPracticeParams, getEnv: getCanvasEnv },
    getClient: CanvasApi.create,
  });
}

export const canvasResourceDiffWorkflowId = "canvas-resource-diff";
