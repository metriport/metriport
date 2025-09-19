import { DbCreds } from "@metriport/shared";
import { out } from "../../../util";

/**
 * Streams patient CSV files from S3 and inserts them into PostgreSQL database.
 * Each CSV file represents a FHIR resource type (e.g., Patient, Condition, Encounter).
 *
 * @param param.cxId - Customer ID
 * @param param.patientId - Patient ID
 * @param param.patientCsvsS3Prefix - S3 prefix containing CSV files
 * @param param.analyticsBucketName - S3 bucket name
 * @param param.region - AWS region
 * @param param.dbCreds - Database credentials
 */
export async function sendPatientCsvsToDb({
  cxId,
  patientId,
  patientCsvsS3Prefix,
  analyticsBucketName,
  region,
  dbCreds,
}: {
  cxId: string;
  patientId: string;
  patientCsvsS3Prefix: string;
  analyticsBucketName: string;
  region: string;
  dbCreds: DbCreds;
}): Promise<void> {
  const { log } = out(`sendPatientCsvsToDb - cx ${cxId}, pt ${patientId}`);
  log(
    `Running with params: ${JSON.stringify({
      cxId,
      patientId,
      patientCsvsS3Prefix,
      analyticsBucketName,
      region,
      host: dbCreds.host,
      port: dbCreds.port,
      dbname: dbCreds.dbname,
      username: dbCreds.username,
    })}`
  );
}
