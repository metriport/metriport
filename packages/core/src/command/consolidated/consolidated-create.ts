import { Bundle } from "@medplum/fhirtypes";
import { executeWithRetriesS3, S3Utils } from "../../external/aws/s3";
import { parseRawBundleForFhirServer } from "../../external/fhir/parse-bundle";
import { out } from "../../util";
import { NonNullableFields } from "../../util/typescript";
import { Consolidated, getConsolidated } from "./consolidated-get";

export type ConsolidatePatientDataCommand = {
  cxId: string;
  patientId: string;
  inputBundleBucket: string;
  inputBundleS3Key: string;
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
    inputBundleBucket,
    inputBundleS3Key,
    logMemUsage,
  }: ConsolidatePatientDataCommand): Promise<void> {
    const { log } = out(`data consolidator - pat ${patientId}`);

    log(`Getting existing consolidated data from bucket ${this.consolidatedBucket}`);
    const getConsolidatedPromise = async (): Promise<NonNullableFields<Consolidated>> => {
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

    log(`Getting input bundle from bucket ${inputBundleBucket}, key ${inputBundleS3Key}`);
    const getInputBundlePromise = executeWithRetriesS3(
      () => this.s3Utils.getFileContentsAsString(inputBundleBucket, inputBundleS3Key),
      { ...defaultS3RetriesConfig, log }
    );

    const [consolidatedData, inputBundleRaw] = await Promise.all([
      getConsolidatedPromise(),
      getInputBundlePromise,
    ]);
    logMemUsage && logMemUsage();

    log(`Converting input bundle to JSON, length ${inputBundleRaw.length}`);
    const inputBundle: Bundle = parseRawBundleForFhirServer(inputBundleRaw, patientId, log);
    logMemUsage && logMemUsage();

    this.merge(inputBundle).into(consolidatedData.bundle);

    // update the original bundle file with the contents of the merged bundle
    await this.s3Utils.uploadFile({
      bucket: consolidatedData.fileLocation,
      key: consolidatedData.fileName,
      file: Buffer.from(JSON.stringify(consolidatedData)),
      contentType: "application/json",
    });
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
