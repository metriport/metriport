export type ProcessCoreTransformRequest = {
  cxId: string;
};

export abstract class CoreTransformHandler {
  abstract processCoreTransform(request: ProcessCoreTransformRequest): Promise<void>;
}
