import _ from "lodash";
import { out } from "../../../util/log";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";

export async function listPatientIdsWithDocuments({ cxId }: { cxId: string }): Promise<string[]> {
  const { log } = out(`sde.listPatientsWithDocuments - cx ${cxId}`);
  log("Listing patients with documents by CX ID...");

  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getCdaToFhirConversionBucketName();
  if (!bucketName) {
    log(`No cda to fhir conversion bucket name found`);
    return [];
  }

  const patientDirectories = await s3.listFirstLevelSubdirectories({
    bucket: bucketName,
    prefix: cxId + "/",
  });
  return _(patientDirectories)
    .map(directory => {
      if (!directory.Prefix) return undefined;
      const [_cxId, patientId] = directory.Prefix.split("/");
      if (!_cxId || _cxId !== cxId || !patientId) return undefined;
      return patientId;
    })
    .compact()
    .value();
}
