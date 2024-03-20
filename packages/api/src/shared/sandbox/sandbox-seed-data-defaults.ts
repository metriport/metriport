import { DocumentReference } from "@medplum/fhirtypes";
import { Config } from "../config";

export const bucket = Config.getSandboxSeedBucketName() ?? "missing-value";

export type DataEntry = {
  s3Info: { bucket: string; key: string };
  docRef: DocumentReference;
};
