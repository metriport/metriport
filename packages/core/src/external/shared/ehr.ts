import {
  AdditionalInfo,
  BadRequestError,
  JwtTokenInfo,
  MetriportError,
  errorToString,
} from "@metriport/shared";
import {
  Patient,
  PatientWithValidHomeAddress,
  patientWithValidHomeAddressFhirSchema,
} from "@metriport/shared/interface/external/shared/ehr/patient";
import { buildDayjs } from "@metriport/shared/common/date";
import { AxiosInstance } from "axios";
import { z } from "zod";
import { createHivePartitionFilePath } from "../../domain/filename";
import { Config } from "../../util/config";
import { processAsyncError } from "../../util/error/shared";
import { uuidv7 } from "../../util/uuid-v7";
import { S3Utils } from "../aws/s3";

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export interface ApiConfig {
  twoLeggedAuthTokenInfo?: JwtTokenInfo | undefined;
  practiceId: string;
  clientKey: string;
  clientSecret: string;
}

export type RequestData = { [key: string]: string | boolean | object | undefined };

function buildS3Path(ehr: string, path: string, key: string): string {
  return `${ehr}/${path}/${key}/${uuidv7()}.json`;
}

export function formatDate(date: string | undefined, format: string): string | undefined {
  if (!date) return undefined;
  const trimmedDate = date.trim();
  const parsedDate = buildDayjs(trimmedDate);
  if (!parsedDate.isValid()) return undefined;
  return parsedDate.format(format);
}

export type MakeRequestParams<T> = {
  ehr: string;
  cxId: string;
  patientId?: string | undefined;
  s3Path: string;
  axiosInstance: AxiosInstance;
  url: string;
  method: "GET" | "POST" | "PATCH";
  data?: RequestData | undefined;
  headers?: Record<string, string> | undefined;
  schema: z.Schema<T>;
  additionalInfo: AdditionalInfo;
  debug: typeof console.log;
};

export type MakeRequestParamsFromMethod<T> = Omit<
  MakeRequestParams<T>,
  "ehr" | "axiosInstance" | "responsesBucket" | "s3Utils"
>;

export async function makeRequest<T>({
  ehr,
  cxId,
  patientId,
  s3Path,
  axiosInstance,
  url,
  method,
  data,
  headers,
  schema,
  additionalInfo,
  debug,
}: MakeRequestParams<T>): Promise<T> {
  const response = await axiosInstance.request({
    method,
    url,
    data: method === "GET" ? undefined : createDataParams(data ?? {}),
    headers: {
      ...axiosInstance.defaults.headers.common,
      ...headers,
    },
  });
  if (!response.data) {
    throw new MetriportError(`No body returned from ${method} ${url}`, undefined, additionalInfo);
  }
  const body = response.data;
  debug(`${method} ${url} resp: `, () => JSON.stringify(response.data));
  if (responsesBucket) {
    const filePath = createHivePartitionFilePath({
      cxId,
      patientId: patientId ?? "global",
      date: new Date(),
    });
    const key = buildS3Path(ehr, s3Path, filePath);
    const s3Utils = getS3UtilsInstance();
    s3Utils
      .uploadFile({
        bucket: responsesBucket,
        key,
        file: Buffer.from(JSON.stringify(response.data), "utf8"),
        contentType: "application/json",
      })
      .catch(processAsyncError(`Error saving to s3 - ${method} ${url}`));
  }
  const outcome = schema.safeParse(body);
  if (!outcome.success) {
    throw new MetriportError(`${method} ${url} response not parsed`, undefined, {
      ...additionalInfo,
      error: errorToString(outcome.error),
    });
  }
  return outcome.data;
}

export function createDataParams(data: RequestData): string {
  const dataParams = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined) return;
    dataParams.append(k, typeof v === "object" ? JSON.stringify(v) : v.toString());
  });
  return dataParams.toString();
}

export function parsePatientFhir(patient: Patient): PatientWithValidHomeAddress {
  if (!patient.address) throw new BadRequestError("No addresses found");
  patient.address = patient.address.filter(a => a.postalCode !== undefined && a.use === "home");
  if (patient.address.length === 0) {
    throw new BadRequestError("No home address with valid zip found");
  }
  return patientWithValidHomeAddressFhirSchema.parse(patient);
}
