import { Bundle } from "@medplum/fhirtypes";
import { executeWithRetriesS3, S3Utils } from "../../external/aws/s3";
import { out } from "../../util";
import { NonNullableFields } from "../../util/typescript";
import { Consolidated, getConsolidated } from "./consolidated-get";

export type ConsolidatePatientDataCommand = {
  cxId: string;
  patientId: string;
  inputBundles: { bucket: string; key: string }[];
  logMemUsage?: () => void;
};

const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};
const emptyBundle: Bundle = {
  resourceType: "Bundle",
  type: "collection",
  total: 0,
  entry: [],
};

export class PatientDataConsolidator {
  readonly s3Utils: S3Utils;
  constructor(private readonly consolidatedBucket: string, region: string) {
    this.s3Utils = new S3Utils(region);
  }

  async execute({
    cxId,
    patientId,
    inputBundles,
    logMemUsage,
  }: ConsolidatePatientDataCommand): Promise<Bundle> {
    const { log } = out(`data consolidator - pat ${patientId}`);

    const getConsolidatedPromise = async (): Promise<NonNullableFields<Consolidated>> => {
      log(`Getting existing consolidated data from bucket ${this.consolidatedBucket}`);
      const consolidated = await getConsolidated({
        cxId,
        patientId,
        fileLocation: this.consolidatedBucket,
        region: this.s3Utils.region,
        log,
      });
      log(`...consolidated key ${consolidated.fileName}`);
      if (!consolidated.bundle) {
        log(`No consolidated data found for patient ${patientId}, creating a new one`);
      }
      const returnBundle = consolidated.bundle ?? emptyBundle;
      return { ...consolidated, bundle: returnBundle };
    };

    const {
      bundle: consolidated,
      fileLocation: destFileLocation,
      fileName: destFileName,
    } = await getConsolidatedPromise();
    logMemUsage && logMemUsage();

    for (const inputBundle of inputBundles) {
      const { bucket, key } = inputBundle;
      log(`Getting input bundle from bucket ${bucket}, key ${key}`);
      const contents = await executeWithRetriesS3(
        () => this.s3Utils.getFileContentsAsString(bucket, key),
        { ...defaultS3RetriesConfig, log }
      );
      const bundle = JSON.parse(contents) as Bundle;
      this.merge(bundle).into(consolidated);
      logMemUsage && logMemUsage();
    }
    log(
      `Consolidated bundle generated/updated, storing it on ${destFileLocation}, key ${destFileName}`
    );
    await this.s3Utils.uploadFile({
      bucket: destFileLocation,
      key: destFileName,
      file: Buffer.from(JSON.stringify(consolidated)),
      contentType: "application/json",
    });

    return consolidated;
  }

  protected merge(inputBundle: Bundle) {
    return {
      into: function (destination: Bundle): Bundle {
        if (!destination.entry) destination.entry = [];
        for (const entry of inputBundle.entry ?? []) {
          destination.entry.push(entry);
        }
        destination.total = destination.entry.length;
        return destination;
      },
    };
  }
}
