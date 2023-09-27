/**
 * Created outside of src/external/aws because this is an open source technology
 * that could be hosted outside of AWS.
 */
export * from "./file-ingestor";
export * from "./file-ingestor-direct";
export * from "./file-ingestor-sqs";
export * from "./file-searcher";
export * from "./file-searcher-direct";

export const contentFieldName = "content";

export type IndexFields = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  [contentFieldName]: string;
};
