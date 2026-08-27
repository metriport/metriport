import { DbCreds, MetriportError } from "@metriport/shared";
import { Config } from "../../../../../util/config";
import { ExportCoreFromFwhToS3Direct } from "./export-core-from-fwh-to-s3-direct";
import { coreDbSchema } from "../../../fwh/utils";
import { Dialect } from "sequelize";

export async function exportCoreFromFwhToS3BatchCommand(): Promise<void> {
  const cxId = process.argv[2];
  const rawToCoreJobId = process.argv[3];
  const jobId = process.argv[4];

  if (!cxId || !rawToCoreJobId || !jobId) {
    throw new MetriportError("Usage: node run-export-batch.js <cxId> <rawToCoreJobId> <jobId>");
  }

  const host = process.env.HOST;
  const port = process.env.PORT;
  const user = process.env.USER;
  const dbname = process.env.DBNAME;
  const engine = process.env.ENGINE;
  const password = process.env.PASSWORD;

  if (!host || !port || !user || !dbname || !engine || !password) {
    throw new MetriportError("Missing env: HOST, PORT, USER, DBNAME, ENGINE, PASSWORD");
  }

  const dbCreds: DbCreds = {
    host,
    port: parseInt(port, 10),
    dbname,
    username: user,
    password,
    engine: engine as Dialect,
    schemaName: coreDbSchema,
  };

  const analyticsBucketName = Config.getAnalyticsBucketName();
  const region = Config.getAWSRegion();
  const exportCoreFromFwhToS3CompletionTopicArn =
    Config.getExportCoreFromFwhToS3CompletionTopicArn();

  const handler = new ExportCoreFromFwhToS3Direct(
    dbCreds,
    analyticsBucketName,
    region,
    exportCoreFromFwhToS3CompletionTopicArn
  );
  await handler.exportCoreFromFwhToS3Sync({ cxId, rawToCoreJobId, jobId });
}
