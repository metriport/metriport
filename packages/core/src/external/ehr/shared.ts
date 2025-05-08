import { Condition } from "@medplum/fhirtypes";
import {
  AdditionalInfo,
  BadRequestError,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
  errorToString,
  executeWithRetries,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  Bundle,
  BundleWithLastModified,
  FhirResource,
  FhirResourceBundle,
  createBundleFromResourceList,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { AxiosInstance, AxiosResponse, isAxiosError } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
import { createHivePartitionFilePath } from "../../domain/filename";
import { fetchCodingCodeOrDisplayOrSystem } from "../../fhir-deduplication/shared";
import { Config } from "../../util/config";
import { SNOMED_CODE } from "../../util/constants";
import { processAsyncError } from "../../util/error/shared";
import { out } from "../../util/log";
import { uuidv7 } from "../../util/uuid-v7";
import { S3Utils } from "../aws/s3";
import { BundleType, isResourceDiffBundleType } from "./bundle/bundle-shared";
import { createOrReplaceBundle } from "./bundle/command/create-or-replace-bundle";
import {
  FetchBundleParams,
  fetchBundle,
  fetchBundlePreSignedUrl,
} from "./bundle/command/fetch-bundle";

dayjs.extend(duration);

const MAX_AGE = dayjs.duration(24, "hours");

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

function buildS3Prefix(ehr: string, path: string, key: string): string {
  return `${ehr}/${path}/${key}`;
}

function buildS3Path(ehr: string, path: string, key: string): string {
  return `${buildS3Prefix(ehr, path, key)}/${uuidv7()}.json`;
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
  method: "GET" | "POST" | "PATCH" | "DELETE";
  data?: RequestData | undefined;
  headers?: Record<string, string> | undefined;
  schema: z.Schema<T>;
  additionalInfo: AdditionalInfo;
  debug: typeof console.log;
};

export type MakeRequestParamsInEhr<T> = Omit<
  MakeRequestParams<T>,
  "ehr" | "practiceId" | "axiosInstance"
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
  const isJsonContentType =
    headers?.["content-type"] === "application/json" ||
    headers?.["Content-Type"] === "application/json";
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
    response = await executeWithRetries(
      () =>
        axiosInstance.request({
          method,
          ...(url !== "" ? { url } : {}),
          data:
            method === "GET" ? undefined : isJsonContentType ? data : createDataParams(data ?? {}),
          headers: {
            ...axiosInstance.defaults.headers.common,
            ...headers,
          },
        }),
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shouldRetry: (_, error: any) => {
          if (!error) return false;
          if (isNotRetriableAxiosError(error)) return false;
          return true;
        },
      }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (isAxiosError(error)) {
      const message = errorToString(error);
      if (responsesBucket) {
        const filePath = createHivePartitionFilePath({
          cxId,
          patientId: patientId ?? "global",
          date: new Date(),
        });
        const key = buildS3Path(ehr, s3Path, `${filePath}/error`);
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
  if (!response.data && method === "DELETE") {
    const outcome = schema.safeParse(undefined);
    if (!outcome.success) {
      const msg = `Response not parsed @ ${ehr}`;
      log(msg);
      throw new MetriportError(msg, undefined, fullAdditionalInfo);
    }
    return outcome.data;
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
    const key = buildS3Path(ehr, s3Path, `${filePath}/response`);
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

export function isNotRetriableAxiosError(error: unknown): boolean {
  return isAxiosError(error) && (error.response?.status === 400 || error.response?.status === 404);
}

export function getConditionSnomedCode(condition: Condition): string | undefined {
  const code = condition.code;
  const snomedCoding = code?.coding?.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(SNOMED_CODE);
  });
  if (!snomedCoding) return undefined;
  return snomedCoding.code;
}

export function getConditionStartDate(condition: Condition): string | undefined {
  return condition.onsetDateTime ?? condition.onsetPeriod?.start;
}

export function getConditionStatus(condition: Condition): string | undefined {
  const statusFromCoding = (condition.clinicalStatus?.coding ?? []).flatMap(coding => {
    const code = coding?.display ?? coding?.code;
    if (!code) return [];
    return [code];
  });
  return condition.clinicalStatus?.text ?? statusFromCoding[0];
}

type FetchEhrBundleParams = Omit<
  FetchBundleParams,
  "bundleType" | "jobId" | "getLastModified" | "s3BucketName"
>;

async function fetchEhrBundleUsingTtl(
  params: FetchEhrBundleParams
): Promise<BundleWithLastModified | undefined> {
  const bundle = await fetchBundle({
    ...params,
    bundleType: BundleType.EHR,
    getLastModified: true,
  });
  if (!bundle || !bundle.lastModified) return undefined;
  const age = dayjs.duration(buildDayjs().diff(bundle.lastModified));
  if (age.asMilliseconds() > MAX_AGE.asMilliseconds()) return undefined;
  return bundle;
}

/**
 * Fetches a pre-signed URL for a bundle from S3 for the given bundle type and resource type.
 * Validates that the job ID is provided when fetching resource diff bundles.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param jobId - The job ID. Optional, required for resource diff bundles only.
 * @returns The pre-signed URL for the bundle.
 */
export async function fetchBundlePreSignedUrlWithValidation(
  params: Omit<FetchBundleParams, "getLastModified" | "s3BucketName">
): Promise<string | undefined> {
  if (isResourceDiffBundleType(params.bundleType as string) && !params.jobId) {
    throw new BadRequestError(
      "Job ID must be provided when fetching resource diff bundles",
      undefined,
      { ...params }
    );
  }
  return await fetchBundlePreSignedUrl(params);
}

/**
 * Fetches a bundle from the EHR for the given bundle type and resource type.
 * Uses cached EHR bundle if available and requested.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param resourceType - The resource type of the bundle.
 * @param fetchResourcesFromEhr - A function that fetches the resources from the EHR.
 * @param useCachedBundle - Whether to use the cached bundle. Optional, defaults to true.
 * @returns The bundle.
 */
export async function fetchEhrBundleUsingCache({
  fetchResourcesFromEhr,
  useCachedBundle = true,
  ...params
}: FetchEhrBundleParams & {
  fetchResourcesFromEhr: () => Promise<FhirResource[]>;
  useCachedBundle?: boolean;
}): Promise<Bundle> {
  if (useCachedBundle) {
    const cachedBundle = await fetchEhrBundleUsingTtl({ ...params });
    if (cachedBundle) return cachedBundle.bundle;
  }
  const fhirResources = await fetchResourcesFromEhr();
  const invalidEntry = fhirResources.find(r => r.resourceType !== params.resourceType);
  if (invalidEntry) {
    throw new BadRequestError("Invalid bundle", undefined, {
      resourceType: params.resourceType,
      resourceTypeInBundle: invalidEntry.resourceType,
    });
  }
  const bundle = createBundleFromResourceList(fhirResources);
  await createOrReplaceBundle({
    ...params,
    bundleType: BundleType.EHR,
    bundle,
  });
  return bundle;
}

/**
 * Fetches FHIR resources from the EHR for the given resource type.
 * Pagination is handled automatically.
 *
 * @param makeRequest - The function that makes the request to the EHR FHIR endpoint.
 * @param url - The URL of the bundle.
 * @param acc - The accumulator of the resources.
 * @returns The FHIR resources.
 */
export async function fetchEhrFhirResourcesWithPagination({
  makeRequest,
  url,
  acc = [],
}: {
  makeRequest: () => Promise<FhirResourceBundle>;
  url: string | undefined;
  acc?: FhirResource[] | undefined;
}): Promise<FhirResource[]> {
  if (!url) return acc;
  const fhirResourceBundle = await makeRequest();
  acc.push(...(fhirResourceBundle.entry ?? []).map(e => e.resource));
  const nextUrl = fhirResourceBundle.link?.find(l => l.relation === "next")?.url;
  return fetchEhrFhirResourcesWithPagination({ makeRequest, url: nextUrl, acc });
}
