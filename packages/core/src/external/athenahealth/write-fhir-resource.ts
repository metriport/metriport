import { Medication } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { makeAthenaHealthApi } from "./api-factory";
import { S3Utils } from "../aws/s3";
import { Config } from "../../util/config";
import { uuidv7 } from "../../util/uuid-v7";
import { createHivePartitionFilePath } from "../../domain/filename";
import { createDataParams } from "./util";

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function writeMedicationToChart({
  cxId,
  accessToken,
  baseUrl,
  patientId,
  practiceId,
  departmentId,
  medication,
}: {
  cxId: string;
  accessToken: string;
  baseUrl: string;
  patientId: string;
  practiceId: string;
  departmentId: string;
  medication: Medication;
}): Promise<void> {
  const { log, debug } = out(`AthenaHealth post chart - AH patientId ${patientId}`);
  if (!medication.id) throw new Error("Medication missing ID");
  const s3Utils = getS3UtilsInstance();
  const api = makeAthenaHealthApi(baseUrl, accessToken);
  const patientUrl = `/v1/${practiceId}/chart/${patientId}/medications`;
  const data = {
    providernote: "Metriport Test 9/18/2024",
    stopreason: "",
    unstructuredsig: "Metriport Test 9/18/2024",
    medicationid: "240169",
    hidden: "",
    departmentid: departmentId,
    startdate: "09%2F18%2F2024",
    THIRDPARTYUSERNAME: "Metriport Test 9/18/2024",
    patientnote: "Metriport Test",
    PATIENTFACINGCALL: "true",
  };
  if (responsesBucket) {
    const filePath = createHivePartitionFilePath({
      cxId,
      patientId,
      keys: {
        practiceId,
        medicationId: medication.id,
      },
      date: new Date(),
    });
    const key = `athenahealth/chart/write-medication/${filePath}/${uuidv7()}.json`;
    await s3Utils.uploadFile({
      bucket: responsesBucket,
      key,
      file: Buffer.from(JSON.stringify(data), "utf8"),
      contentType: "application/json",
    });
  }
  try {
    const dataParams = createDataParams(data);
    const resp = await api.post(patientUrl, dataParams, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    debug(`${patientUrl} resp: ${JSON.stringify(resp.data)}`);
  } catch (error) {
    const msg = `Failure while pushing medication to chart @ AthenHealth`;
    log(`${msg}. Patient ID: ${patientId}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        baseUrl,
        patientId,
        context: "athenahealth.write-medication-to-chart",
        error,
      },
    });
    throw error;
  }
}
