import { Config } from "../../../../../util/config";
import { coreDbSchema } from "../../../fwh/utils";
import { ExportCoreFromFwhToS3Handler } from "./export-core-from-fwh-to-s3";
import { ExportCoreFromFwhToS3Cloud } from "./export-core-from-fwh-to-s3-cloud";
import { ExportCoreFromFwhToS3Direct } from "./export-core-from-fwh-to-s3-direct";

export function buildExportCoreFromFwhToS3Handler(): ExportCoreFromFwhToS3Handler {
  if (Config.isDev()) {
    const dbCreds = Config.getAnalyticsDbCreds();
    const rawToCoreUsername = Config.getRawToCoreDbUsername();
    const rawToCorePassword = Config.getRawToCoreDbPassword();
    return new ExportCoreFromFwhToS3Direct({
      ...dbCreds,
      schemaName: coreDbSchema,
      username: rawToCoreUsername,
      password: rawToCorePassword,
    });
  }
  return new ExportCoreFromFwhToS3Cloud();
}
