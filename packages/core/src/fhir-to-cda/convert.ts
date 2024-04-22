import { Input } from "../domain/conversion/fhir-to-cda";
import { cdaDocumentUploaderHandler } from "../shareback/cda-uploader";
import { Config } from "../util/config";
import { convertFhirBundleToCda } from "./fhir-to-cda";

export async function convertToCdaAndUpload({
  cxId,
  patientId,
  bundle,
  organization,
}: Input): Promise<void> {
  const cdaBundles = convertFhirBundleToCda(bundle);
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
