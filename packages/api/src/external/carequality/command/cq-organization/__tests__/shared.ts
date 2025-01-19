import { APIMode } from "@metriport/carequality-sdk";
import { getEnvVar } from "@metriport/shared";

export function getApiMode(): APIMode {
  const apiModeVarName = "CQ_API_MODE";
  const apiMode = getEnvVar(apiModeVarName);
  if (apiMode === "stage") return APIMode.staging;
  if (apiMode === "dev") return APIMode.dev;
  if (apiMode === "production") return APIMode.production;
  throw new Error(`Invalid ${apiModeVarName}: ${apiMode}`);
}
