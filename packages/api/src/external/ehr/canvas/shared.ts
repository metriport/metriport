import CanvasApi, { CanvasEnv } from "@metriport/core/external/canvas/index";
import { cxClientKeyAndSecretMapSecretSchema, MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { createEhrClient, EhrClienUniqueClientParams, EhrEnvAndClientCredentials } from "../shared";

export const canvasClientJwtTokenSource = "canvas-client";

export function getCanvasEnv({
  cxId,
  practiceId,
}: EhrClienUniqueClientParams): EhrEnvAndClientCredentials<CanvasEnv> {
  const rawClientsMap = Config.getCanvasClientKeyAndSecretMap();
  if (!rawClientsMap) throw new Error("Canvas secrets map not set");
  const clientMap = cxClientKeyAndSecretMapSecretSchema.safeParse(JSON.parse(rawClientsMap));
  if (!clientMap.success) {
    throw new MetriportError("Canvas clients map has invalid format", undefined, {
      rawClientsMap: !Config.isProdEnv() ? rawClientsMap : undefined,
    });
  }
  const cxEnv = `${cxId}_${practiceId}_env`;
  const cxEnvEntry = clientMap.data[cxEnv];
  const cxKey = `${cxId}_${practiceId}_key`;
  const cxKeyEntry = clientMap.data[cxKey];
  const cxSecret = `${cxId}_${practiceId}_secret`;
  const cxSecretEntry = clientMap.data[cxSecret];
  if (!cxEnvEntry || !cxKeyEntry || !cxSecretEntry)
    throw new MetriportError("Canvas credentials not found");
  return {
    environment: cxEnvEntry,
    clientKey: cxKeyEntry,
    clientSecret: cxSecretEntry,
  };
}

export async function createCanvasClient(
  unqiueParams: EhrClienUniqueClientParams
): Promise<CanvasApi> {
  return await createEhrClient<EhrClienUniqueClientParams, CanvasEnv, CanvasApi>({
    ...unqiueParams,
    source: canvasClientJwtTokenSource,
    getEnv: getCanvasEnv,
    getEnvParams: unqiueParams,
    getClient: CanvasApi.create,
  });
}
