import {
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  Bundle,
  Coding,
  Condition,
  Immunization,
  Medication,
  MedicationAdministration,
  MedicationDispense,
  MedicationStatement,
  Observation,
  Procedure,
  Resource,
} from "@medplum/fhirtypes";
import {
  AdditionalInfo,
  BadRequestError,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
  errorToString,
  executeWithRetries,
  sleep,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  EhrFhirResourceBundle,
  EhrStrictFhirResource,
  EhrStrictFhirResourceBundle,
  createBundleFromResourceList,
  ehrFhirResourceBundleSchema,
  ehrStrictFhirResourceBundleSchema,
  ehrStrictFhirResourceSchema,
  fhirOperationOutcomeSchema,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { AxiosError, AxiosInstance, AxiosResponse, isAxiosError } from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { partition, uniqBy } from "lodash";
import { z } from "zod";
import { createHivePartitionFilePath } from "../../domain/filename";
import { fetchCodingCodeOrDisplayOrSystem } from "../../fhir-deduplication/shared";
import { executeAsynchronously } from "../../util/concurrency";
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
import { capture } from "../../util/notifications";
import { uuidv7 } from "../../util/uuid-v7";
import { S3Utils } from "../aws/s3";
import { BundleType } from "./bundle/bundle-shared";
import { createOrReplaceBundle } from "./bundle/command/create-or-replace-bundle";
import { FetchBundleParams, fetchBundle } from "./bundle/command/fetch-bundle";

dayjs.extend(duration);

const MAX_AGE = dayjs.duration(24, "hours");

export const paginateWaitTime = dayjs.duration(1, "seconds");

const fhirValidationPrefix = "1 validation error for";

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(Config.getAWSRegion());
}

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
  const responsesBucket = Config.getEhrResponsesBucketName();
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
        case 422:
          throw new BadRequestError(message, error, fullAdditionalInfoWithError);
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

// TYPES FROM DASHBOARD
export type MedicationWithRefs = {
  medication: Medication;
  administration: MedicationAdministration[];
  dispense: MedicationDispense[];
  statement: MedicationStatement[];
};

export type GroupedVitals = {
  mostRecentObservation: Observation;
  sortedPoints?: DataPoint[];
};

export type BloodPressure = {
  systolic: number;
  diastolic: number;
};

export type DataPoint = {
  value: number;
  date: string;
  unit?: string;
  bp?: BloodPressure | undefined;
};

export function isVital(observation: Observation): boolean {
  const isVital = observation.category?.find(
    ext => ext.coding?.[0]?.code?.toLowerCase() === "vital-signs"
  );
  return isVital !== undefined;
}

export function isLab(observation: Observation): boolean {
  const isLab = observation.category?.find(
    ext => ext.coding?.[0]?.code?.toLowerCase() === "laboratory"
  );
  return isLab !== undefined;
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

export function getObservationUnit(observation: Observation): string | undefined {
  const firstReference = observation.referenceRange?.[0];
  return (
    observation.valueQuantity?.unit?.toString() ??
    firstReference?.low?.unit?.toString() ??
    firstReference?.high?.unit?.toString()
  );
}

const blacklistedValues = ["see below", "see text", "see comments", "see note"];
export function getObservationValue(observation: Observation): number | string | undefined {
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
export function buildObservationReferenceRange(
  observation: Observation
): ReferenceRange | undefined {
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

export function getObservationLoincCode(observation: Observation): string | undefined {
  const loincCoding = getObservationLoincCoding(observation);
  if (!loincCoding) return undefined;
  return loincCoding.code;
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

type FetchEhrBundleParams = Omit<FetchBundleParams, "bundleType">;

/**
 * Fetches EHR bundle for the given resource type if it is younger than the max age,
 * otherwise returns undefined.
 *
 * @param params - The parameters for the fetch bundle.
 * @returns The bundle if it is younger than the max age, otherwise undefined.
 */
async function fetchEhrBundleIfYoungerThanMaxAge(
  params: Omit<FetchEhrBundleParams, "getLastModified">
): Promise<Bundle | undefined> {
  const bundle = await fetchBundle({
    ...params,
    bundleType: BundleType.EHR,
    getLastModified: true,
  });
  if (!bundle || !bundle.lastModified) return undefined;
  const age = dayjs.duration(buildDayjs().diff(bundle.lastModified));
  if (age.asMilliseconds() > MAX_AGE.asMilliseconds()) return undefined;
  return bundle.bundle;
}

/**
 * Fetches EHR bundle for the given resource type.
 * Uses cached EHR bundle if available and requested.
 * Refreshes the cache if the bundle is fetched from the EHR.
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
  fetchResourcesFromEhr: () => Promise<EhrStrictFhirResource[]>;
  useCachedBundle?: boolean;
}): Promise<Bundle> {
  if (useCachedBundle) {
    const cachedBundle = await fetchEhrBundleIfYoungerThanMaxAge({ ...params });
    if (cachedBundle) return cachedBundle;
  }
  const fhirResources = await fetchResourcesFromEhr();
  const bundle = createBundleFromResourceList(fhirResources as Resource[]);
  await createOrReplaceBundle({
    ...params,
    bundleType: BundleType.EHR,
    bundle,
  });
  return bundle;
}

/**
 * Fetches FHIR resources via a FHIR API and returns them as list.
 * Pagination is handled automatically.
 *
 * @param makeRequest - The function that makes the request to the EHR FHIR endpoint.
 * @param url - The URL of the bundle.
 * @param acc - The accumulator of the resources. Optional, defaults to an empty array.
 * @returns The FHIR resources.
 */
export async function fetchEhrFhirResourcesWithPagination({
  makeRequest,
  url,
  acc = [],
}: {
  makeRequest: (url: string) => Promise<EhrStrictFhirResourceBundle>;
  url: string | undefined;
  acc?: EhrStrictFhirResource[] | undefined;
}): Promise<EhrStrictFhirResource[]> {
  if (!url) return acc;
  await sleep(paginateWaitTime.asMilliseconds());
  const fhirResourceBundle = await makeRequest(url);
  acc.push(...(fhirResourceBundle.entry ?? []).map(e => e.resource));
  const nextUrl = fhirResourceBundle.link?.find(l => l.relation === "next")?.url;
  return fetchEhrFhirResourcesWithPagination({ makeRequest, url: nextUrl, acc });
}

/**
 * Saves resources from a reference bundle to the S3 bucket along resource IDs.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param referenceBundle - The reference bundle to save.
 */
export async function saveEhrReferenceBundle({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  referenceBundle,
}: {
  ehr: EhrSource;
  cxId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  referenceBundle: EhrFhirResourceBundle;
}) {
  const { log } = out(
    `saveReferenceBundle - cxId ${cxId} metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId}`
  );
  if (!referenceBundle.entry || referenceBundle.entry.length < 1) return;
  const resources: EhrStrictFhirResource[] = referenceBundle.entry.flatMap(e => {
    const resource = e.resource;
    if (!resource) return [];
    const parsedResource = ehrStrictFhirResourceSchema.safeParse(resource);
    if (!parsedResource.success) return [];
    return parsedResource.data;
  });
  const saveReferenceBundleArgs = uniqBy(resources, "id");
  const saveReferenceBundleErrors: { error: unknown; id: string; type: string }[] = [];
  await executeAsynchronously(saveReferenceBundleArgs, async (params: EhrStrictFhirResource) => {
    try {
      await createOrReplaceBundle({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        bundleType: BundleType.EHR,
        bundle: createBundleFromResourceList([params as Resource]),
        resourceType: params.resourceType,
        resourceId: params.id,
      });
    } catch (error) {
      log(`Failed to save reference bundle entry ${params.id}. Cause: ${errorToString(error)}`);
      saveReferenceBundleErrors.push({ error, id: params.id, type: params.resourceType });
    }
  });
  if (saveReferenceBundleErrors.length > 0) {
    const msg = `Failure while saving some reference bundle entries @ ${ehr}`;
    capture.message(msg, {
      extra: {
        saveReferenceBundleArgsCount: saveReferenceBundleArgs.length,
        saveReferenceBundleErrorsCount: saveReferenceBundleErrors.length,
        errors: saveReferenceBundleErrors,
        context: `${ehr}.save-reference-bundle`,
      },
      level: "warning",
    });
  }
}

/**
 * Partitions an EHR bundle into a target bundle and a reference bundle.
 * The target bundle contains the resources of the given resource type.
 * The reference bundle contains the resources of the other resource types.
 *
 * @param bundle - The bundle to partition.
 * @param resourceType - The resource type of the target bundle.
 * @returns The target bundle and the reference bundle.
 */
export function partitionEhrBundle({
  bundle,
  resourceType,
}: {
  bundle: EhrFhirResourceBundle;
  resourceType: string;
}): { targetBundle: EhrFhirResourceBundle; referenceBundle: EhrFhirResourceBundle } {
  const [targetBundleEntries, referenceBundleEntries] = partition(
    bundle.entry ?? [],
    e => e.resource?.resourceType === resourceType
  );
  const targetBundle: EhrFhirResourceBundle = ehrFhirResourceBundleSchema.parse({
    ...bundle,
    entry: targetBundleEntries,
  });
  const referenceBundle: EhrFhirResourceBundle = ehrFhirResourceBundleSchema.parse({
    ...bundle,
    entry: referenceBundleEntries,
  });
  return { targetBundle, referenceBundle };
}

/**
 * Converts a single-resource-type EHR bundle to a strict EHR bundle, where all resources have the
 * id and resourceType fields. It also checks that the patient and subject references are the same as
 * the patientId.
 *
 * @param bundle - The bundle to convert.
 * @param resourceType - The resource type of the bundle.
 * @param patientId - The patient ID of the bundle.
 * @returns The strict EHR bundle.
 * @throws BadRequestError if the bundle is invalid, contains multiple resource types, or contains
 * a resource with a patient or subject reference that is not the same as the patientId.
 */
export function convertEhrBundleToValidEhrStrictBundle(
  bundle: EhrFhirResourceBundle,
  resourceType: string,
  patientId?: string
): EhrStrictFhirResourceBundle {
  const strictBundle = ehrStrictFhirResourceBundleSchema.safeParse(bundle);
  if (!strictBundle.success) {
    throw new BadRequestError("Invalid bundle", undefined, {
      zodError: errorToString(strictBundle.error),
    });
  }
  if (!strictBundle.data.entry || strictBundle.data.entry.length < 1) return strictBundle.data;
  if (!patientId) return strictBundle.data;
  for (const entry of strictBundle.data.entry) {
    if (entry.resource.resourceType !== resourceType) {
      throw new BadRequestError("Invalid resource type in bundle", undefined, {
        resourceType,
        resourceTypeInBundle: entry.resource.resourceType,
      });
    }
    if (entry.resource.patient && entry.resource.patient.reference !== `Patient/${patientId}`) {
      throw new BadRequestError("Invalid patient in bundle", undefined, {
        resourceType,
        resourceTypeInBundle: entry.resource.resourceType,
      });
    }
    if (entry.resource.subject && entry.resource.subject.reference !== `Patient/${patientId}`) {
      throw new BadRequestError("Invalid subject in bundle", undefined, {
        resourceType,
        resourceTypeInBundle: entry.resource.resourceType,
      });
    }
  }
  return strictBundle.data;
}
