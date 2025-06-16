import { MetriportError } from "@metriport/shared";
import { Config } from "../../../../util/config";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { SurescriptsConvertBatchResponseHandler } from "./convert-batch-response";
import { SurescriptsReplica } from "../../replica";
import {
  SurescriptsConversionBundle,
  SurescriptsFileIdentifier,
  SurescriptsRequester,
} from "../../types";
import { convertBatchResponseToFhirBundles } from "../../fhir-converter";
import { makeConversionBundleFileName } from "../../file/file-names";

export class SurescriptsConvertBatchResponseHandlerDirect
  implements SurescriptsConvertBatchResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica) {}

  async convertBatchResponse({
    cxId,
    transmissionId,
    populationId,
  }: SurescriptsRequester & SurescriptsFileIdentifier): Promise<SurescriptsConversionBundle[]> {
    const responseFileContent = await this.replica.getRawResponseFile({
      transmissionId,
      populationId,
    });
    if (!responseFileContent) {
      throw new MetriportError(
        `No response file stored for transmissionId: ${transmissionId} and populationId: ${populationId}`,
        undefined,
        {
          transmissionId,
          populationId,
        }
      );
    }

    const conversionBucket = new S3Utils(Config.getAWSRegion());
    const conversionBundles = await convertBatchResponseToFhirBundles(responseFileContent);
    for (const { patientId, bundle } of conversionBundles) {
      const fileName = makeConversionBundleFileName(cxId, patientId);
      await conversionBucket.uploadFile({
        bucket: Config.getPharmacyConversionBucketName(),
        key: fileName,
        file: Buffer.from(JSON.stringify(bundle)),
      });
    }
    return conversionBundles;
  }
}
