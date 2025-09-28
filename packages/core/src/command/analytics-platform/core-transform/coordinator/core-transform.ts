export type ProcessCoreTransformRequest = {
  cxId: string;
  databaseName: string;
  schemaName: string;
};

export abstract class CoreTransformHandler {
  abstract processCoreTransform(request: ProcessCoreTransformRequest): Promise<void>;
}
