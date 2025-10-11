import { startCoreTransform } from "../../core-transfom/command/core-transform";
import { CoreTransformHandler, ProcessCoreTransformRequest } from "./core-transform";

export class CoreTransformCloud extends CoreTransformHandler {
  constructor() {
    super();
  }

  async processCoreTransform(params: ProcessCoreTransformRequest): Promise<void> {
    const { cxId, databaseName, schemaName } = params;
    await startCoreTransform({
      cxId,
      database: databaseName,
      schema: schemaName,
    });
  }
}
