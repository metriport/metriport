import _ from "lodash";
import { out } from "../../../../util/log";
import { S3Utils } from "../../../aws/s3";
import { Config } from "../../../../util/config";

export async function listPatientIdsWithDocuments({ cxId }: { cxId: string }): Promise<string[]> {
  const { log } = out(`sde.listPatientsWithDocuments - cx ${cxId}`);
  log("Listing patients with documents by CX ID...");

  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getCdaToFhirConversionBucketName();
  if (!bucketName) {
    log(`No cda to fhir conversion bucket name found`);
    return [];
  }

  const objects = await s3.listObjects(bucketName, cxId);

  const patientIds = _(objects)
    .map(object => {
      const key = object.Key;
      if (!key) return undefined;
      const parts = key.split("/");
      return parts.length === 3 ? parts[1] : undefined;
    })
    .compact()
    .uniq()
    .value();

  return patientIds;
}
