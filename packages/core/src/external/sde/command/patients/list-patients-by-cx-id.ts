import { out } from "../../../../util/log";
import { S3Utils } from "../../../aws/s3";
import { Config } from "../../../../util/config";
import _ from "lodash";
import { PatientReference, ListPatientsByCxIdInput } from "../../types";

export async function listPatientsByCxId({
  cxId,
  bucketName,
}: ListPatientsByCxIdInput): Promise<PatientReference[]> {
  const { log } = out(`sde.listPatientsByCxId - cx ${cxId}, bucketName ${bucketName}`);
  log("Listing patients by CX ID...");

  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketNameToUse = bucketName ?? Config.getCdaToFhirConversionBucketName();
  log(`Bucket name: ${bucketNameToUse}`);
  if (!bucketNameToUse) {
    log(`No cda to fhir conversion bucket name found, skipping`);
    return [];
  }

  const objects = await s3.listObjects(bucketNameToUse, cxId);

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

  return patientIds.map(patientId => ({ cxId, patientId }));
}
