import {
  patientResourceSchema,
  PatientResource,
} from "@metriport/shared/interface/external/athenahealth/patient";
import { errorToString } from "@metriport/shared";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
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
  const { log, debug } = out(`AthenaHealth get - AH patientId ${patientId}`);
  const s3Utils = getS3UtilsInstance();
  const api = makeAthenaHealthApi(baseUrl, accessToken);
  const patientUrl = `/fhir/r4/Patient/${patientId}`;
  try {
    const resp = await api.get(patientUrl);
    if (!resp.data) throw new Error(`No body returned from ${patientUrl}`);
    debug(`${patientUrl} resp: ${JSON.stringify(resp.data)}`);
    if (responsesBucket) {
      const filePath = createHivePartitionFilePath({
        cxId,
        patientId,
        date: new Date(),
      });
      const key = `athenahealth/${filePath}/${uuidv7()}.json`;
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
    if (error.response?.status === 404) return undefined;
    const msg = `Failure while getting patient @ AthenHealth`;
    log(`${msg}. Patient ID: ${patientId}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        baseUrl,
        patientId,
        context: "athenahealth.get-patient",
        error,
      },
    });
    throw error;
  }
}
