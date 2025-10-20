import { cxClientKeyAndSecretMapSecretSchema, MetriportError } from "@metriport/shared";
import { ElationEnv, isElationEnv } from ".";
import { Config } from "../../../util/config";
import { EhrEnvAndClientCredentials, EhrPerPracticeParams } from "../environment";

export function getElationEnv({
  cxId,
  practiceId,
}: EhrPerPracticeParams): EhrEnvAndClientCredentials<ElationEnv> {
  const environment = Config.getElationEnv();
  if (!environment) throw new MetriportError("Elation environment not set");
  if (!isElationEnv(environment)) {
    throw new MetriportError("Invalid Elation environment", undefined, { environment });
  }
  const clientMap = getClientMap();
  const key = `${cxId}_${practiceId}_key`;
  const keyEntry = clientMap[key];
  const secret = `${cxId}_${practiceId}_secret`;
  const secretEntry = clientMap[secret];
  if (!keyEntry || !secretEntry) throw new MetriportError("Elation credentials not found");
  return {
    environment,
    clientKey: keyEntry,
    clientSecret: secretEntry,
  };
}

export function getClientMap() {
  const rawClientsMap = Config.getElationClientKeyAndSecretMap();
  if (!rawClientsMap) throw new MetriportError("Elation secrets map not set");
  const clientMap = cxClientKeyAndSecretMapSecretSchema.safeParse(JSON.parse(rawClientsMap));
  if (!clientMap.success) throw new MetriportError("Elation clients map has invalid format");
  return clientMap.data;
}
