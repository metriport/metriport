import { Input } from "../domain/conversion/fhir-to-cda";
import { cdaDocumentUploaderHandler } from "../shareback/cda-uploader";
import { Config } from "../util/config";
import { out } from "../util/log";
import { convertFhirBundleToCda } from "./fhir-to-cda";

export async function convertToCdaAndUpload({
  cxId,
  patientId,
  bundle,
  organization,
}: Input): Promise<void> {
  const { log } = out(`CDA Upload cx ${cxId}, patient ${patientId}`);
  const cdaBundles = convertFhirBundleToCda(bundle);
  log(`Converted ${cdaBundles.length} CDA bundles. Will upload them to S3.`);
  for (const cdaBundle of cdaBundles) {
    await cdaDocumentUploaderHandler({
      cxId,
      patientId,
      cdaBundle,
      medicalDocumentsBucket: Config.getMedicalDocumentsBucketName(),
      region: Config.getAWSRegion(),
      organization,
    });
  }
}
