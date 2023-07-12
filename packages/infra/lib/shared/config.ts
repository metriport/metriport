import { Node } from "constructs";
import "source-map-support/register";
import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";

export const METRICS_NAMESPACE = "Metriport";

let config: EnvConfig | undefined;

export function getConfig(): EnvConfig {
  if (!config) throw new Error(`Config not initialized`);
  return config;
}

//-------------------------------------------
// Parse config based on specified env
//-------------------------------------------
export async function initConfig(node: Node): Promise<EnvConfig> {
  const env = node.tryGetContext("env");
  const validVals = Object.values(EnvType);
  if (!env || !validVals.includes(env)) {
    throw new Error(
      `Context variable missing on CDK command. Pass in as "-c env=XXX". Valid values are: ${validVals}`
    );
  }
  const configPath = `../../config/${env}`;
  const configModule = await import(configPath);
  if (!configModule || !configModule.default) {
    throw new Error(`Ensure config is defined, could not fine file ${configPath}`);
  }
  config = configModule.default as EnvConfig;
  return config;
}
