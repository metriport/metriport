import _ from "lodash";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { S3Utils } from "../../../aws/s3";
import { getCdaToFhirConversionPrefix } from "../../file-names";
import { PatientWithDocuments, ListDocumentsPerPatientInput } from "../../types";

const documentKeyFilter = ".xml.json";

export async function listDocumentsPerPatient({
  cxId,
  patientId,
  bucketName,
}: ListDocumentsPerPatientInput): Promise<PatientWithDocuments> {
  const { log } = out(`sde.listDocumentsPerPatient - cx ${cxId}, pat ${patientId}`);
  log("Listing documents...");

  const s3 = new S3Utils(Config.getAWSRegion());
  const bucketNameToUse = bucketName ?? Config.getCdaToFhirConversionBucketName();
  log(`Bucket name: ${bucketNameToUse}`);
  if (!bucketNameToUse) {
    log(`No cda to fhir conversion bucket name found, skipping`);
    return { cxId, patientId, documents: [] };
  }

  const documents = await s3.listObjects(
    bucketNameToUse,
    getCdaToFhirConversionPrefix({ cxId, patientId })
  );

  const documentList = _(documents)
    .map(document => document.Key)
    .compact()
    .filter(key => key.endsWith(documentKeyFilter))
    .map(key => ({ bucket: bucketNameToUse, key }))
    .value();

  return { cxId, patientId, documents: documentList };
}
