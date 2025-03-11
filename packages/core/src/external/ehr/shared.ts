import {
  AdditionalInfo,
  BadRequestError,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
  errorToString,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { EhrSource } from "@metriport/shared/src/interface/external/ehr/source";
import { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import { z } from "zod";
import { createHivePartitionFilePath } from "../../domain/filename";
import { Config } from "../../util/config";
import { processAsyncError } from "../../util/error/shared";
import { out } from "../../util/log";
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
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
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

export type MakeRequestParamsInEhr<T> = Omit<
  MakeRequestParams<T>,
  "ehr" | "practiceId" | "axiosInstance" | "responsesBucket" | "s3Utils"
>;

export async function makeRequest<T>({
  ehr,
  cxId,
  practiceId,
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
  const { log } = out(
    `${ehr} makeRequest - cxId ${cxId} patientId ${patientId} method ${method} url ${url}`
  );
  const isJsonContentType = headers?.["content-type"] === "application/json";
  const fullAdditionalInfo = {
    ...additionalInfo,
    cxId,
    practiceId,
    patientId,
    method,
    url,
    context: `${ehr}.make-request`,
  };
  let response: AxiosResponse;
  try {
    response = await axiosInstance.request({
      method,
      url,
      data: method === "GET" ? undefined : isJsonContentType ? data : createDataParams(data ?? {}),
      headers: {
        ...axiosInstance.defaults.headers.common,
        ...headers,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof AxiosError) {
      const message = createAxiosErrorMessage(error);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: patientId ?? "global",
          date: new Date(),
        });
        const key = buildS3Path(ehr, s3Path, `${filePath}-error`);
        const s3Utils = getS3UtilsInstance();
        s3Utils
          .uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify({ error, message }), "utf8"),
            contentType: "application/json",
          })
          .catch(processAsyncError(`Error saving error to s3 @ ${ehr} - ${method} ${url}`));
      }
      const fullAdditionalInfoWithError = { ...fullAdditionalInfo, error: errorToString(error) };
      switch (error.response?.status) {
        case 400:
          throw new BadRequestError(message, undefined, fullAdditionalInfoWithError);
        case 404:
          throw new NotFoundError(message, undefined, fullAdditionalInfoWithError);
        default:
          throw new MetriportError(message, undefined, fullAdditionalInfoWithError);
      }
    }
    throw error;
  }
  if (!response.data) {
    const msg = `No body returned @ ${ehr}`;
    log(msg);
    throw new MetriportError(msg, undefined, fullAdditionalInfo);
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
      .catch(processAsyncError(`Error saving to s3 @ ${ehr} - ${method} ${url}`));
  }
  const outcome = schema.safeParse(body);
  if (!outcome.success) {
    const msg = `Response not parsed @ ${ehr}`;
    log(`${msg}. Schema: ${schema.description}`);
    throw new MetriportError(msg, undefined, {
      ...fullAdditionalInfo,
      schema: schema.description,
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

function createAxiosErrorMessage(error: AxiosError): string {
  if (error.response?.data) {
    return Object.entries(error.response.data)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v.toString()}`)
      .join(", ");
  }
  return error.message;
}
