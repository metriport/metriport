import { DbCreds, DbCredsWithSchema } from "@metriport/shared";
import { out } from "../../../../util/log";
import { getCxDbName } from "../../csv-to-db/db-asset-defs";
import { exportCoreToS3 } from "../core-to-s3";
import { transformRawToCore } from "../transformer/raw-to-core";
import { CoreTransformHandler, ProcessCoreTransformRequest } from "./core-transform";
import { rawDbSchema } from "../../csv-to-db/db-asset-defs";

export class CoreTransformDirect extends CoreTransformHandler {
  constructor(
    private readonly analyticsBucketName: string,
    private readonly region: string,
    private readonly dbCreds: DbCreds,
    private readonly rawToCoreLambdaName: string
  ) {
    super();
  }

  async processCoreTransform({ cxId }: ProcessCoreTransformRequest): Promise<void> {
    const { log } = out(`CoreTransformDirect.processCoreTransform - cx ${cxId}`);

    const cxDbName = getCxDbName(cxId, this.dbCreds.dbname);

    const dbCreds: DbCredsWithSchema = {
      ...this.dbCreds,
      dbname: cxDbName,
      schemaName: rawDbSchema,
    };

    let startedAt = Date.now();
    log(`Starting Raw to Core transform...`);
    await transformRawToCore({
      cxId,
      dbCreds,
      region: this.region,
      lambdaName: this.rawToCoreLambdaName,
    });
    log(`Done transformRawToCore in ${Date.now() - startedAt}ms, exporting core data to S3...`);

    startedAt = Date.now();
    await exportCoreToS3({
      cxId,
      analyticsBucketName: this.analyticsBucketName,
      region: this.region,
      dbCreds,
    });
    log(`Done exportCoreToS3 in ${Date.now() - startedAt}ms`);
  }
}
