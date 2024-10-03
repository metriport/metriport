import { Config } from "../../util/config";
import { BulkUplaodHandler } from "./bulk-upload";
import { BulkUplaodHandlerDirect } from "./bulk-upload-direct";
import { BulkUplaodHandlerLambda } from "./bulk-upload-lambda";

export function makeBulkUplaodHandler(): BulkUplaodHandler {
  if (!Config.isCloudEnv()) return new BulkUplaodHandlerDirect();
  return new BulkUplaodHandlerLambda();
}
