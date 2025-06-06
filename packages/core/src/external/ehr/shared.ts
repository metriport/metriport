import {
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  Coding,
  Condition,
  Immunization,
  Medication,
  MedicationStatement,
  Observation,
  Procedure,
} from "@medplum/fhirtypes";
import {
  AdditionalInfo,
  BadRequestError,
  BundleWithLastModified,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
  errorToString,
  executeWithRetries,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { fhirOperationOutcomeSchema } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { AxiosError, AxiosInstance, AxiosResponse, isAxiosError } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { z } from "zod";
import { createHivePartitionFilePath } from "../../domain/filename";
import { fetchCodingCodeOrDisplayOrSystem } from "../../fhir-deduplication/shared";
import { Config } from "../../util/config";
import {
  CPT_CODE,
  CVX_CODE,
  ICD_10_CODE,
  LOINC_CODE,
  RXNORM_CODE,
  SNOMED_CODE,
} from "../../util/constants";
import { out } from "../../util/log";
import { uuidv7 } from "../../util/uuid-v7";
import { S3Utils } from "../aws/s3";
import { FetchBundleParams, fetchBundle } from "./bundle/command/fetch-bundle";

dayjs.extend(duration);

const MAX_AGE = dayjs.duration(24, "hours");

const region = Config.getAWSRegion();
const responsesBucket = Config.getEhrResponsesBucketName();

export const paginateWaitTime = dayjs.duration(1, "seconds");

const fhirValidationPrefix = "1 validation error for";

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export const getSecretsOauthSchema = z.object({
  environment: z.string(),
  clientKey: z.string(),
  clientSecret: z.string(),
});
export type GetSecretsOauthResult = z.infer<typeof getSecretsOauthSchema>;

export const getSecretsApiKeySchema = z.object({
  environment: z.string(),
  apiKey: z.string(),
});
export type GetSecretsApiKeyResult = z.infer<typeof getSecretsApiKeySchema>;

export interface ApiConfig {
  twoLeggedAuthTokenInfo?: JwtTokenInfo | undefined;
  practiceId: string;
  clientKey: string;
  clientSecret: string;
}

export type RequestData = { [key: string]: string | boolean | number | object | undefined };

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
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: RequestData | undefined;
  headers?: Record<string, string> | undefined;
  schema: z.Schema<T>;
  additionalInfo: AdditionalInfo;
  debug: typeof console.log;
  emptyResponse?: boolean;
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
  emptyResponse = false,
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
        try {
          await s3Utils.uploadFile({
            bucket: responsesBucket,
            key,
            file: Buffer.from(JSON.stringify({ error, message }), "utf8"),
            contentType: "application/json",
          });
        } catch (error) {
          log(
            `Error saving error to s3 @ ${ehr} - ${method} ${url}. Cause: ${errorToString(error)}`
          );
        }
      }
      const fullAdditionalInfoWithError = { ...fullAdditionalInfo, error: errorToString(error) };
      switch (error.response?.status) {
        case 400:
          throw new BadRequestError(message, error, fullAdditionalInfoWithError);
        case 404:
          throw new NotFoundError(message, error, fullAdditionalInfoWithError);
        default:
          if (isFhirValidationError(error)) {
            throw new NotFoundError(message, error, fullAdditionalInfoWithError);
          }
          throw new MetriportError(message, error, fullAdditionalInfoWithError);
      }
    }
    throw error;
  }
  if (!response.data && emptyResponse) {
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
    try {
      await s3Utils.uploadFile({
        bucket: responsesBucket,
        key,
        file: Buffer.from(JSON.stringify(response.data), "utf8"),
        contentType: "application/json",
      });
    } catch (error) {
      log(
        `Error saving response to s3 @ ${ehr} - ${method} ${url}. Cause: ${errorToString(error)}`
      );
    }
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

function isFhirValidationError(error: AxiosError): boolean {
  const data = error.response?.data;
  if (!data) return false;
  const outcomeParsed = fhirOperationOutcomeSchema.safeParse(data);
  if (!outcomeParsed.success) return false;
  const outcome = outcomeParsed.data;
  const errorInOutcome = outcome.issue.find(issue => issue.severity === "error");
  if (!errorInOutcome) return false;
  const isValidationError = errorInOutcome.details.text.startsWith(fhirValidationPrefix);
  return isValidationError;
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
  return (
    isAxiosError(error) &&
    (error.response?.status === 400 ||
      error.response?.status === 404 ||
      isFhirValidationError(error))
  );
}

export function getMedicationRxnormCoding(medication: Medication): Coding | undefined {
  const code = medication.code;
  const rxnormCoding = code?.coding?.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(RXNORM_CODE);
  });
  if (!rxnormCoding) return undefined;
  return rxnormCoding;
}

export function getMedicationStatementStartDate(
  statement: MedicationStatement
): string | undefined {
  return statement.effectiveDateTime ?? statement.effectivePeriod?.start;
}

export function getConditionIcd10Coding(condition: Condition): Coding | undefined {
  const code = condition.code;
  const icdCoding = code?.coding?.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(ICD_10_CODE);
  });
  if (!icdCoding) return undefined;
  return icdCoding;
}

export function getConditionSnomedCoding(condition: Condition): Coding | undefined {
  const code = condition.code;
  const snomedCoding = code?.coding?.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(SNOMED_CODE);
  });
  if (!snomedCoding) return undefined;
  return snomedCoding;
}

export function getConditionSnomedCode(condition: Condition): string | undefined {
  const snomedCoding = getConditionSnomedCoding(condition);
  if (!snomedCoding) return undefined;
  return snomedCoding.code;
}

export function getConditionStartDate(condition: Condition): string | undefined {
  return condition.onsetDateTime ?? condition.onsetPeriod?.start;
}

const qualifierSuffix = "(qualifier value)";

export function getConditionStatus(condition: Condition): string | undefined {
  const statusFromCoding = (condition.clinicalStatus?.coding ?? []).flatMap(coding => {
    const code = coding?.display ?? coding?.code;
    if (!code) return [];
    return [code];
  });
  const status = condition.clinicalStatus?.text ?? statusFromCoding[0];
  if (status) return status.replace(qualifierSuffix, "").trim();
  return undefined;
}

export function getImmunizationCvxCoding(immunization: Immunization): Coding | undefined {
  const code = immunization.vaccineCode;
  const cvxCoding = code?.coding?.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(CVX_CODE);
  });
  if (!cvxCoding) return undefined;
  return cvxCoding;
}

export function getImmunizationCvxCode(immunization: Immunization): string | undefined {
  const cvxCoding = getImmunizationCvxCoding(immunization);
  if (!cvxCoding) return undefined;
  return cvxCoding.code;
}

export function getImmunizationAdministerDate(immunization: Immunization): string | undefined {
  const administeredDate = immunization.occurrenceDateTime;
  if (administeredDate) return administeredDate;
  const administeredString = immunization.occurrenceString;
  if (!administeredString) return undefined;
  const parsedDate = buildDayjs(administeredString);
  if (!parsedDate.isValid()) return undefined;
  return parsedDate.toISOString();
}

function getObservationUnit(observation: Observation): string | undefined {
  const firstReference = observation.referenceRange?.[0];
  return (
    observation.valueQuantity?.unit?.toString() ??
    firstReference?.low?.unit?.toString() ??
    firstReference?.high?.unit?.toString()
  );
}

const blacklistedValues = ["see below", "see text", "see comments", "see note"];
function getObservationValue(observation: Observation): number | string | undefined {
  let value: number | string | undefined;
  if (observation.valueQuantity) {
    value = observation.valueQuantity.value;
  } else if (observation.valueCodeableConcept) {
    value = observation.valueCodeableConcept.text;
  } else if (observation.valueString) {
    const parsedNumber = parseFloat(observation.valueString);
    value = isNaN(parsedNumber) ? observation.valueString : parsedNumber;
    if (blacklistedValues.includes(value?.toString().toLowerCase().trim())) value = undefined;
  }
  if (!value) return undefined;
  return value;
}

type ReferenceRange = {
  low: number | undefined;
  high: number | undefined;
  unit: string | undefined;
  text?: string | undefined;
};
function buildObservationReferenceRange(observation: Observation): ReferenceRange | undefined {
  const firstReference = observation.referenceRange?.[0];
  if (!firstReference) return undefined;
  const range: ReferenceRange = {
    low: firstReference?.low?.value,
    high: firstReference?.high?.value,
    unit: firstReference?.low?.unit?.toString() ?? firstReference?.high?.unit?.toString(),
    text: firstReference?.text?.toLowerCase().trim(),
  };
  return range;
}

const highInterpretations = ["high", "critical"];
const lowInterpretations = ["low"];
const normalInterpretations = ["normal", "negative", "none seen", "not detected", "neg"];
const abnormalInterpretations = ["abnormal", "positive"];

function getExplicitInterpretation(obs: Observation): string | undefined {
  const interpretationText =
    obs.interpretation?.[0]?.text === "unknown" ? undefined : obs.interpretation?.[0]?.text;

  return (
    interpretationText ??
    obs.interpretation?.[0]?.coding?.[0]?.display ??
    obs.interpretation?.[0]?.coding?.[0]?.code
  );
}

function normalizeStringInterpretation(interpretation: string): string {
  const lowerInterp = interpretation.toLowerCase().trim();
  if (lowerInterp.includes("low")) {
    return "low";
  } else if (lowerInterp.includes("high") || lowerInterp.includes("positive")) {
    return "high";
  } else if (lowerInterp.includes("normal") || lowerInterp.includes("negative")) {
    return "normal";
  } else if (lowerInterp.includes("abnormal")) return "abnormal";
  return interpretation;
}

export function getObservationLoincCoding(observation: Observation): Coding | undefined {
  const code = observation.code;
  const loincCoding = code?.coding?.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(LOINC_CODE);
  });
  if (!loincCoding) return undefined;
  return loincCoding;
}

export function getObservationUnitAndValue(
  observation: Observation
): [string, number | string] | undefined {
  const unit = getObservationUnit(observation);
  if (!unit) return undefined;
  const value = getObservationValue(observation);
  if (!value) return undefined;
  return [unit, value];
}

export function getObservationReferenceRange(observation: Observation): string | undefined {
  const range = buildObservationReferenceRange(observation);
  const unit = getObservationUnit(observation);

  if (range?.low != undefined && range?.high != undefined) {
    return `${range?.low} - ${range?.high} ${unit}`;
  } else if (range?.low != undefined) {
    return `>= ${range?.low} ${unit}`;
  } else if (range?.high != undefined) {
    return `<= ${range?.high} ${unit}`;
  } else if (range?.text && range?.text !== "unknown") {
    return range?.text;
  } else {
    return "-";
  }
}

export function getObservationResultStatus(observation: Observation): string | undefined {
  const resultStatus = observation.status;
  if (!resultStatus) return undefined;
  return resultStatus;
}

export function getObservationObservedDate(observation: Observation): string | undefined {
  return observation.effectiveDateTime ?? observation.effectivePeriod?.start;
}

export function getObservationInterpretation(
  obs: Observation,
  value: number | string | undefined
): string | undefined {
  const explicitInterpretation = getExplicitInterpretation(obs);
  if (explicitInterpretation) {
    return normalizeStringInterpretation(explicitInterpretation);
  }

  const referenceRange = buildObservationReferenceRange(obs);
  if (typeof value === "number" && referenceRange) {
    const low = referenceRange.low;
    const high = referenceRange.high;

    if (low != undefined && value >= low && high != undefined && value <= high) {
      return "normal";
    } else if (low != undefined && value < low) {
      return "low";
    } else if (low != undefined && value > low) {
      return "normal";
    } else if (high != undefined && value < high) {
      return "normal";
    } else if (high != undefined && value > high) {
      return "high";
    }
  } else if (typeof value === "string") {
    const normalizedValue = value.toLowerCase().trim();
    if (highInterpretations.includes(normalizedValue)) return "high";
    if (lowInterpretations.includes(normalizedValue)) return "low";
    if (normalInterpretations.includes(normalizedValue)) return "normal";
    if (abnormalInterpretations.includes(normalizedValue)) return "abnormal";
  }

  if (highInterpretations.includes(explicitInterpretation?.toLowerCase() ?? "")) return "high";
  return undefined;
}

export function getAllergyIntoleranceSubstanceRxnormCoding(
  allergyIntoleranceReaction: AllergyIntoleranceReaction
): Coding | undefined {
  const substance = allergyIntoleranceReaction.substance;
  if (!substance) return undefined;
  const rxnormCoding = substance.coding?.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(RXNORM_CODE);
  });
  if (!rxnormCoding) return undefined;
  return rxnormCoding;
}

export function getAllergyIntoleranceManifestationSnomedCoding(
  allergyIntoleranceReaction: AllergyIntoleranceReaction
): Coding | undefined {
  const manifestations = allergyIntoleranceReaction.manifestation;
  if (!manifestations) return undefined;
  const manifestationCodings = manifestations.flatMap(manifestation => manifestation.coding ?? []);
  const snomedCoding = manifestationCodings.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(SNOMED_CODE);
  });
  if (!snomedCoding) return undefined;
  return snomedCoding;
}

export function getAllergyIntoleranceOnsetDate(
  allergyIntolerance: AllergyIntolerance
): string | undefined {
  return allergyIntolerance.onsetDateTime ?? allergyIntolerance.onsetPeriod?.start;
}

export function getProcedureCptCoding(procedure: Procedure): Coding | undefined {
  const code = procedure.code;
  const loincCoding = code?.coding?.find(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return system?.includes(CPT_CODE);
  });
  if (!loincCoding) return undefined;
  return loincCoding;
}

export function getProcedureCptCode(procedure: Procedure): string | undefined {
  const cptCoding = getProcedureCptCoding(procedure);
  if (!cptCoding) return undefined;
  return cptCoding.code;
}

export function getProcedurePerformedDate(procedure: Procedure): string | undefined {
  return procedure.performedDateTime ?? procedure.performedPeriod?.start;
}

/**
 * Fetches a bundle from S3 for the given bundle type and resource type
 * Checks if the bundle is younger than the max age, if so, it returns the bundle, otherwise it returns undefined.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The bundle with the last modified date if it is younger than the max age, otherwise undefined.
 */
export async function fetchBundleUsingTtl({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  resourceType,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchBundleParams): Promise<BundleWithLastModified | undefined> {
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    bundleType,
    resourceType,
    s3BucketName,
    getLastModified: true,
  });
  if (!bundle || !bundle.lastModified) return undefined;
  const age = dayjs.duration(buildDayjs().diff(bundle.lastModified));
  if (age.asMilliseconds() > MAX_AGE.asMilliseconds()) return undefined;
  return bundle;
}
