import { cxClientKeyAndSecretMapSecretSchema, MetriportError } from "@metriport/shared";
import { CanvasEnv } from ".";
import { Config } from "../../../util/config";
import { EhrEnvAndClientCredentials, EhrPerPracticeParams } from "../environment";

export function getCanvasEnv({
  cxId,
  practiceId,
}: EhrPerPracticeParams): EhrEnvAndClientCredentials<CanvasEnv> {
  const rawClientsMap = Config.getCanvasClientKeyAndSecretMap();
  if (!rawClientsMap) throw new Error("Canvas secrets map not set");
  const clientMap = cxClientKeyAndSecretMapSecretSchema.safeParse(JSON.parse(rawClientsMap));
  if (!clientMap.success) throw new MetriportError("Canvas clients map has invalid format");
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
