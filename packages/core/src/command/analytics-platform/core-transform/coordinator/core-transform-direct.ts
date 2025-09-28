import { DbCreds, DbCredsWithSchema } from "@metriport/shared";
import { out } from "../../../../util/log";
import { startCoreTransform } from "../../core-transfom/command/core-transform";
import { getCxDbName, rawDbSchema } from "../../csv-to-db/db-asset-defs";
import { CoreTransformHandler, ProcessCoreTransformRequest } from "./core-transform";

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
    log(`Calling startCoreTransform...`);
    // TODO ENG0954 to only send database + schema

    await startCoreTransform({
      cxId,
      host: dbCreds.host,
      user: dbCreds.username,
      password: dbCreds.password,
      database: cxDbName,
      schema: rawDbSchema,
    });

    log(`Done calling startCoreTransform in ${Date.now() - startedAt}ms`);
  }
}
