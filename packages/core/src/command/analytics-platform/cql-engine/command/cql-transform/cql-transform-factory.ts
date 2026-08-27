import { Config } from "../../../../../util/config";
import { CqlTransformHandler } from "./cql-transform";
import { CqlTransformCloud } from "./cql-transform-cloud";
import { CqlTransformDirect } from "./cql-transform-direct";

export function buildCqlTransformHandler(): CqlTransformHandler {
  if (Config.isDev()) {
    return new CqlTransformDirect();
  }
  return new CqlTransformCloud();
}
