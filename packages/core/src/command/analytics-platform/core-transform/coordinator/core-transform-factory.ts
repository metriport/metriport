import { CoreTransformHandler } from "./core-transform";
import { CoreTransformCloud } from "./core-transform-cloud";

export function buildCoreTransformHandler(): CoreTransformHandler {
  // TODO ENG-1167 add direct implementation when we have it on local env
  return new CoreTransformCloud();
}
