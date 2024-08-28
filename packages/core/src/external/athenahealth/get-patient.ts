import {
  patientResourceSchema,
  PatientResource,
} from "@metriport/shared/interface/external/athenahealth/patient";
import { makeAthenaHealthApi } from "./api-factory";
import { S3Utils } from "../aws/s3";
import { Config } from "../../util/config";
import { uuidv7 } from "../../util/uuid-v7";
import { createHivePartitionFilePath } from "../../domain/filename";

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function getPatient({
  cxId,
  accessToken,
  baseUrl,
  patientId,
}: {
  cxId: string;
  accessToken: string;
  baseUrl: string;
  patientId: string;
}): Promise<PatientResource | undefined> {
  const s3Utils = getS3UtilsInstance();
  const api = makeAthenaHealthApi(baseUrl, accessToken);
  const patientUrl = `/fhir/r4/Patient/${patientId}`;
  try {
    const resp = await api.get(patientUrl);
    if (!resp.data) throw new Error(`No body returned from ${patientUrl}`);
    console.log(`${patientUrl} resp: ${JSON.stringify(resp.data)}`);
    if (responsesBucket) {
      const filePath = createHivePartitionFilePath({
        cxId,
        patientId,
        date: new Date(),
      });
      const key = `${filePath}/${uuidv7()}.json`;
      await s3Utils.uploadFile({
        bucket: responsesBucket,
        key,
        file: Buffer.from(JSON.stringify(resp.data), "utf8"),
        contentType: "application/json",
      });
    }
    return patientResourceSchema.parse(resp.data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(error);
    if (error.response.status === 404) return undefined;
    throw error;
  }
}
