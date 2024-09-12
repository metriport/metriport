import { Bundle } from "@medplum/fhirtypes";
import { createConsolidatedDataFilePath } from "../../domain/consolidated/filename";
import { executeWithRetriesS3, returnUndefinedOn404, S3Utils } from "../../external/aws/s3";
import { parseRawBundleForFhirServer } from "../../external/fhir/parse-bundle";
import { out } from "../../util";

export type ConsolidatePatientDataCommand = {
  cxId: string;
  patientId: string;
  newBundleBucket: string;
  newBundleS3Key: string;
  logMemUsage?: () => void;
};

const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};
const emptyBundle: Bundle = {
  resourceType: "Bundle",
  type: "batch",
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
    newBundleBucket,
    newBundleS3Key,
    logMemUsage,
  }: ConsolidatePatientDataCommand): Promise<void> {
    const { log } = out(`data consolidator - pat ${patientId}`);

    const consolidatedS3Key = createConsolidatedDataFilePath(cxId, patientId);

    log(
      `Getting consolidated data from bucket ${this.consolidatedBucket}, key ${consolidatedS3Key}`
    );
    const getConsolidatedPromise = executeWithRetriesS3<string | undefined>(
      async () =>
        returnUndefinedOn404(() =>
          this.s3Utils.getFileContentsAsString(this.consolidatedBucket, consolidatedS3Key)
        ),
      { ...defaultS3RetriesConfig, log }
    );

    log(`Getting new bundle from bucket ${newBundleBucket}, key ${newBundleS3Key}`);
    const getNewBundlePromise = executeWithRetriesS3(
      () => this.s3Utils.getFileContentsAsString(newBundleBucket, newBundleS3Key),
      { ...defaultS3RetriesConfig, log }
    );

    const [consolidatedDataRaw, newBundleRaw] = await Promise.all([
      getConsolidatedPromise,
      getNewBundlePromise,
    ]);

    const consolidatedData = parseConsolidatedRaw(consolidatedDataRaw, patientId, log);
    logMemUsage && logMemUsage();

    log(`Converting new bundle to JSON, length ${newBundleRaw.length}`);
    const newBundle: Bundle = parseRawBundleForFhirServer(newBundleRaw, patientId, log);
    logMemUsage && logMemUsage();

    this.merge(newBundle).into(consolidatedData);

    // update the original bundle file with the contents of the merged bundle
    await this.s3Utils.uploadFile({
      bucket: this.consolidatedBucket,
      key: consolidatedS3Key,
      file: Buffer.from(JSON.stringify(consolidatedData)),
      contentType: "application/json",
    });
  }

  protected merge(newBundle: Bundle) {
    return {
      into: function (destination: Bundle): Bundle {
        for (const entry of newBundle.entry ?? []) {
          destination.entry?.push(entry);
        }
        return destination;
      },
    };
  }
}

function parseConsolidatedRaw(
  contents: string | undefined,
  patientId: string,
  log: typeof console.log
): Bundle {
  if (contents) {
    log(`Converting payload to JSON, length ${contents.length}`);
    return JSON.parse(contents) as Bundle;
  }
  log(`No consolidated data found for patient ${patientId}, creating a new one`);
  return emptyBundle;
}
