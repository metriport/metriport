import { CoreTransformHandler } from "./core-transform";
import { CoreTransformCloud } from "./core-transform-cloud";

export function buildCoreTransformHandler(): CoreTransformHandler {
  // We don't have the direct implementation here because it requires params that are not available
  // in the cloud environment. Keeping the factory for maintainability.
  return new CoreTransformCloud();
}
