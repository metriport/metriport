import { Bundle, Resource } from "@medplum/fhirtypes";
import { parseFhirBundle } from "@metriport/shared/medical";
import { createConsolidatedDataFilePath } from "../../domain/consolidated/filename";
import { executeWithRetriesS3, returnUndefinedOn404, S3Utils } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";
import { getConsolidatedLocation } from "./consolidated-shared";

const s3Utils = new S3Utils(Config.getAWSRegion());

const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};

export type Consolidated = {
  bundle: Bundle<Resource> | undefined;
  fileLocation: string;
  fileName: string;
};

export async function getConsolidated({
  cxId,
  patientId,
  fileLocation = getConsolidatedLocation(),
}: {
  cxId: string;
  patientId: string;
  fileLocation?: string;
}): Promise<Consolidated> {
  const { log } = out(`getConsolidated - cx ${cxId}, pat ${patientId}`);
  const fileName = createConsolidatedDataFilePath(cxId, patientId);

  const consolidatedDataRaw = await executeWithRetriesS3<string | undefined>(
    async () => returnUndefinedOn404(() => s3Utils.getFileContentsAsString(fileLocation, fileName)),
    { ...defaultS3RetriesConfig, log }
  );
  const bundle = parseConsolidatedRaw(consolidatedDataRaw, log);
  return { bundle, fileLocation, fileName };
}

function parseConsolidatedRaw(
  contents: string | undefined,
  log: typeof console.log
): Bundle | undefined {
  if (!contents) return undefined;
  log(`Converting payload to JSON, length ${contents.length}`);
  return parseFhirBundle(contents);
}
