import {
  AllergyIntolerance,
  Bundle,
  Condition,
  MedicationRequest,
  Resource,
  ResourceType,
} from "@medplum/fhirtypes";
import {
  BadRequestError,
  EhrFhirResourceBundle,
  ehrFhirResourceBundleSchema,
  errorToString,
  executeWithNetworkRetries,
  JwtTokenInfo,
  MetriportError,
  NotFoundError,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { createPracticeFusionCodeableConcept } from "@metriport/shared/external";
import { Patient, patientSchema } from "@metriport/shared/interface/external/ehr/patient";
import {
  Appointment,
  appointmentRefSchema,
  AppointmentsQueryResult,
  appointmentsQueryResultSchema,
} from "@metriport/shared/interface/external/ehr/practicefusion/appointment";
import { refreshTokenResponseSchema } from "@metriport/shared/interface/external/ehr/practicefusion/refresh-token";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";
import { out } from "../../../util/log";
import {
  ApiConfig,
  convertEhrBundleToValidEhrStrictBundle,
  fetchEhrBundleUsingCache,
  fetchEhrFhirResourcesWithPagination,
  getAllergyIntoleranceCode,
  getAllergyIntoleranceOnsetDate,
  getConditionCategory,
  getConditionIcd10Coding,
  getConditionSnomedCoding,
  getConditionStartDate,
  makeRequest,
  MakeRequestParamsInEhr,
  MedicationWithRefs,
} from "../shared";

export interface PracticeFusionApiConfig extends ApiConfig {
  environment: string;
  refreshToken: string;
}

const practicefusionEnv = [
  "int-api", // - dev
  "qa-api", // - staging
  "rc-api",
  "stg-api",
  "pte-api",
  "api", // - prod
] as const;

export type PracticeFusionEnv = (typeof practicefusionEnv)[number];

export function isPracticeFusionEnv(env: string): env is PracticeFusionEnv {
  return practicefusionEnv.includes(env as PracticeFusionEnv);
}

const practiceFusionDomainExtension = ".practicefusion.com";
const defaultCountOrLimit = 100;

export const supportedPracticeFusionResources: ResourceType[] = [
  "AllergyIntolerance",
  "Condition",
  "MedicationRequest",
];

export type SupportedPracticeFusionResource = (typeof supportedPracticeFusionResources)[number];

export function isSupportedPracticeFusionResource(
  resourceType: string
): resourceType is SupportedPracticeFusionResource {
  return supportedPracticeFusionResources.includes(resourceType as ResourceType);
}

export const supportedPracticeFusionReferenceResources: ResourceType[] = [
  "Medication",
  "Practitioner",
  "Organization",
  "Location",
];

export type SupportedPracticeFusionReferenceResource =
  (typeof supportedPracticeFusionReferenceResources)[number];

export function isSupportedPracticeFusionReferenceResource(
  resourceType: string
): resourceType is SupportedPracticeFusionReferenceResource {
  return supportedPracticeFusionReferenceResources.includes(resourceType as ResourceType);
}

class PracticeFusionApi {
  private axiosInstanceFhir: AxiosInstance;
  private axiosInstanceProprietary: AxiosInstance;
  private refreshTokenAuthTokenInfo: JwtTokenInfo | undefined;
  private baseUrl: string;
  private practiceId: string;

  private constructor(private config: PracticeFusionApiConfig) {
    this.refreshTokenAuthTokenInfo = config.twoLeggedAuthTokenInfo;
    this.axiosInstanceFhir = axios.create({});
    this.axiosInstanceProprietary = axios.create({});
    this.baseUrl = `${config.environment}${practiceFusionDomainExtension}`;
    this.practiceId = config.practiceId;
  }

  public static async create(config: PracticeFusionApiConfig): Promise<PracticeFusionApi> {
    const instance = new PracticeFusionApi(config);
    await instance.initialize();
    return instance;
  }

  getRefreshTokenAuthTokenInfo(): JwtTokenInfo | undefined {
    return this.refreshTokenAuthTokenInfo;
  }

  private getFhirBaseUrl() {
    return `https://${this.baseUrl}/fhir/r4/v1/${this.practiceId}`;
  }

  async discoverSmartConfig(): Promise<{
    tokenEndpoint: string;
    authorizationEndpoint: string;
  }> {
    const discoveryUrl = `${this.getFhirBaseUrl()}/.well-known/smart-configuration`;
    try {
      const response = await executeWithNetworkRetries(() => axios.get(discoveryUrl));
      const config = response.data;
      if (!config?.token_endpoint || !config?.authorization_endpoint) {
        throw new MetriportError("Invalid SMART config response", undefined, {
          discoveryUrl,
        });
      }
      return {
        tokenEndpoint: config.token_endpoint,
        authorizationEndpoint: config.authorization_endpoint,
      };
    } catch (error) {
      throw new MetriportError("Failed to discover SMART config @ PracticeFusion", undefined, {
        error: errorToString(error),
        discoveryUrl,
      });
    }
  }

  private async refreshAccessToken(): Promise<JwtTokenInfo> {
    const { refreshToken, clientKey, clientSecret } = this.config;

    const { tokenEndpoint } = await this.discoverSmartConfig();

    const payload = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientKey,
      client_secret: clientSecret,
    });

    try {
      const response = await executeWithNetworkRetries(() =>
        axios.post(tokenEndpoint, payload, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );
      if (!response.data) throw new MetriportError("No body returned from token endpoint");
      const tokenData = refreshTokenResponseSchema.parse(response.data);
      return {
        access_token: tokenData.access_token,
        exp: new Date(Date.now() + tokenData.expires_in * 1000),
      };
    } catch (error) {
      throw new MetriportError("Failed to refresh OAuth token @ PracticeFusion", undefined, {
        error: errorToString(error),
      });
    }
  }

  async initialize(): Promise<void> {
    const { log } = out(`PracticeFusion initialize - practiceId ${this.practiceId}`);
    if (!this.refreshTokenAuthTokenInfo) {
      log(`Auth token not found @ PracticeFusion - refreshing token`);
      this.refreshTokenAuthTokenInfo = await this.refreshAccessToken();
    } else if (this.refreshTokenAuthTokenInfo.exp < buildDayjs().add(15, "minutes").toDate()) {
      log(`Auth token expired @ PracticeFusion - refreshing token`);
      this.refreshTokenAuthTokenInfo = await this.refreshAccessToken();
    } else {
      log(`Auth token found @ PracticeFusion - using existing token`);
    }

    const authHeaders = {
      Accept: "application/json",
      // For refresh_token flow SCOPES are defined from the UI!
      Authorization: `Bearer ${this.refreshTokenAuthTokenInfo.access_token}`,
      "Content-Type": "application/json",
    };

    this.axiosInstanceFhir = axios.create({
      baseURL: this.getFhirBaseUrl(),
      headers: authHeaders,
    });

    this.axiosInstanceProprietary = axios.create({
      baseURL: `https://${this.baseUrl}/ehr`,
      headers: authHeaders,
    });
  }

  async getPatient({ cxId, patientId }: { cxId: string; patientId: string }): Promise<Patient> {
    const { debug } = out(
      `PracticeFusion getPatient - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const patientUrl = `/Patient/${patientId}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, patientId };
    const patient = await this.makeRequest<Patient>({
      cxId,
      patientId,
      s3Path: "patient",
      method: "GET",
      url: patientUrl,
      schema: patientSchema,
      additionalInfo,
      debug,
    });
    // PracticeFusion does not return address.country, their developer said to assume it is USA
    return this.ensureAddressCountry(patient);
  }

  async getAppointment({ cxId, eventId }: { cxId: string; eventId: string }): Promise<Appointment> {
    const { debug } = out(
      `PracticeFusion getAppointment - cxId ${cxId} practiceId ${this.practiceId} eventId ${eventId}`
    );
    const url = `/calendar/v2/events/${eventId}`;
    const additionalInfo = { cxId, practiceId: this.practiceId, eventId };

    const response = await this.makeRequest({
      cxId,
      s3Path: "appointment",
      method: "GET",
      url,
      schema: appointmentRefSchema,
      additionalInfo,
      debug,
      useFhir: false,
    });

    return response.event;
  }

  async getAppointments({
    cxId,
    startDate,
    endDate,
    pageSize,
    pageToken,
  }: {
    cxId: string;
    startDate: Date;
    endDate: Date;
    pageSize?: number;
    pageToken?: string;
  }): Promise<AppointmentsQueryResult> {
    const { debug } = out(
      `PracticeFusion getAppointments - cxId ${cxId} practiceId ${this.practiceId}`
    );

    const params = new URLSearchParams({
      minimumStartDateTimeUtc: startDate.toISOString(),
      maximumStartDateTimeUtc: endDate.toISOString(),
    });
    if (pageSize) params.append("pageSize", pageSize.toString());
    if (pageToken) params.append("pageToken", pageToken);

    const url = `/calendar/v2/events/query?${params.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    return this.makeRequest({
      cxId,
      s3Path: "appointments",
      method: "GET",
      url,
      schema: appointmentsQueryResultSchema,
      additionalInfo,
      debug,
      useFhir: false,
    });
  }

  async createCondition({
    cxId,
    patientId,
    condition,
  }: {
    cxId: string;
    patientId: string;
    condition: Condition;
  }): Promise<void> {
    const { debug } = out(
      `PracticeFusion createCondition - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      conditionId: condition.id,
    };
    const cleanCondition = this.formatCondition(
      this.stripMetriportRelatedData(
        this.appendPatientReferenceToResource(condition, patientId, "subject")
      ),
      additionalInfo
    );
    await this.makeRequest({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("condition", condition.id),
      method: "POST",
      url: "/Condition",
      data: { ...cleanCondition },
      headers: { "Content-Type": "application/fhir+json" },
      schema: z.unknown(),
      additionalInfo,
      debug,
    });
  }

  async createAllergyIntolerance({
    cxId,
    patientId,
    allergyIntolerance,
  }: {
    cxId: string;
    patientId: string;
    allergyIntolerance: AllergyIntolerance;
  }): Promise<void> {
    const { debug } = out(
      `PracticeFusion createAllergyIntolerance - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      allergyIntoleranceId: allergyIntolerance.id,
    };
    const cleanAllergy = this.formatAllergyIntolerance(
      this.stripMetriportRelatedData(
        this.appendPatientReferenceToResource(allergyIntolerance, patientId, "patient")
      ),
      additionalInfo
    );
    await this.makeRequest({
      cxId,
      patientId,
      s3Path: this.createWriteBackPath("allergy", allergyIntolerance.id),
      method: "POST",
      url: "/AllergyIntolerance",
      data: { ...cleanAllergy },
      headers: { "Content-Type": "application/fhir+json" },
      schema: z.unknown(),
      additionalInfo,
      debug,
    });
  }

  async createMedicationRequest({
    cxId,
    patientId,
    medicationWithRefs,
  }: {
    cxId: string;
    patientId: string;
    medicationWithRefs: MedicationWithRefs;
  }): Promise<void> {
    const { debug } = out(
      `PracticeFusion createMedicationRequest - cxId ${cxId} practiceId ${this.practiceId} patientId ${patientId}`
    );
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId,
      medicationId: medicationWithRefs.medication.id,
    };
    if (medicationWithRefs.requests.length < 1) {
      throw new BadRequestError("No medication requests found", undefined, additionalInfo);
    }
    for (const medicationRequest of medicationWithRefs.requests) {
      const cleanMedRequest = this.formatMedicationRequest(
        this.stripMetriportRelatedData(
          this.appendPatientReferenceToResource(medicationRequest, patientId, "subject")
        ),
        medicationWithRefs,
        additionalInfo
      );
      await this.makeRequest({
        cxId,
        patientId,
        s3Path: this.createWriteBackPath(
          "medicationRequest",
          cleanMedRequest.id ?? medicationWithRefs.medication.id
        ),
        method: "POST",
        url: "/MedicationRequest",
        data: { ...cleanMedRequest },
        headers: { "Content-Type": "application/fhir+json" },
        schema: z.unknown(),
        additionalInfo,
        debug,
      });
    }
  }

  private appendPatientReferenceToResource<T extends Resource>(
    resource: T,
    patientId: string,
    referenceKey: "patient" | "subject"
  ): T {
    return {
      ...resource,
      [referenceKey]: { type: "Patient", reference: `Patient/${patientId}` },
    } as T;
  }

  private stripMetriportRelatedData<T extends Resource>(resource: T): T {
    const { meta, ...rest } = resource;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { source, ...metaRest } = meta ?? {};
    const hasMetaFields = Object.keys(metaRest).length > 0;
    return { ...rest, ...(hasMetaFields ? { meta: metaRest } : {}) } as T;
  }

  private createWriteBackPath(resourceType: string, resourceId: string | undefined): string {
    return `write-back/${resourceType}/${resourceId ?? "unknown"}`;
  }

  private ensureAddressCountry(patient: Patient): Patient {
    if (!patient.address) return patient;
    return {
      ...patient,
      address: patient.address.map(addr => ({
        ...addr,
        country: addr.country ?? "USA",
      })),
    };
  }

  private async makeRequest<T>({
    cxId,
    patientId,
    s3Path,
    url,
    method,
    data,
    headers,
    schema,
    additionalInfo,
    debug,
    emptyResponse = false,
    useFhir = true,
  }: MakeRequestParamsInEhr<T> & { useFhir?: boolean }): Promise<T> {
    const axiosInstance = useFhir ? this.axiosInstanceFhir : this.axiosInstanceProprietary;
    return await makeRequest<T>({
      ehr: EhrSources.practicefusion,
      cxId,
      practiceId: this.practiceId,
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
      emptyResponse,
    });
  }

  private formatAllergyIntolerance(
    allergyIntolerance: AllergyIntolerance,
    additionalInfo: Record<string, string | undefined>
  ): AllergyIntolerance {
    const formattedAllergyIntolerance: AllergyIntolerance = {
      resourceType: "AllergyIntolerance",
      ...(allergyIntolerance.id ? { id: allergyIntolerance.id } : {}),
      ...(allergyIntolerance.patient ? { patient: allergyIntolerance.patient } : {}),
      ...(allergyIntolerance.recorder ? { recorder: allergyIntolerance.recorder } : {}),
      ...(allergyIntolerance.meta ? { meta: allergyIntolerance.meta } : {}),
      ...(allergyIntolerance.verificationStatus
        ? { verificationStatus: allergyIntolerance.verificationStatus }
        : {}),
      ...(allergyIntolerance.clinicalStatus
        ? { clinicalStatus: allergyIntolerance.clinicalStatus }
        : {}),
      ...(allergyIntolerance.extension ? { extension: allergyIntolerance.extension } : {}),
      ...(allergyIntolerance.reaction ? { reaction: allergyIntolerance.reaction } : {}),
      ...(allergyIntolerance.criticality ? { criticality: allergyIntolerance.criticality } : {}),
    };
    const matchedCodableConcept = createPracticeFusionCodeableConcept(
      getAllergyIntoleranceCode(allergyIntolerance)
    );
    if (!matchedCodableConcept) {
      throw new BadRequestError(
        "No matching code.text found for allergen",
        undefined,
        additionalInfo
      );
    }
    formattedAllergyIntolerance.code = matchedCodableConcept;
    const onsetDate = getAllergyIntoleranceOnsetDate(allergyIntolerance);
    if (onsetDate) {
      formattedAllergyIntolerance.onsetDateTime = onsetDate;
    }
    return formattedAllergyIntolerance;
  }

  private formatCondition(
    condition: Condition,
    additionalInfo: Record<string, string | undefined>
  ): Condition {
    const formattedCondition: Condition = {
      resourceType: "Condition",
      ...(condition.id ? { id: condition.id } : {}),
      ...(condition.recorder ? { recorder: condition.recorder } : {}),
      ...(condition.subject ? { subject: condition.subject } : {}),
      ...(condition.meta ? { meta: condition.meta } : {}),
      ...(condition.verificationStatus ? { verificationStatus: condition.verificationStatus } : {}),
      ...(condition.clinicalStatus ? { clinicalStatus: condition.clinicalStatus } : {}),
      ...{ category: getConditionCategory(condition) },
    };
    const icd10Coding = getConditionIcd10Coding(condition);
    const snomedCoding = getConditionSnomedCoding(condition);
    if (!icd10Coding && !snomedCoding) {
      throw new BadRequestError(
        "No ICD-10 or Snomed code found for condition",
        undefined,
        additionalInfo
      );
    }
    const hasValidIcd10 = !!icd10Coding?.code && !!icd10Coding?.display;
    const hasValidSnomed = !!snomedCoding?.code && !!snomedCoding?.display;
    if (!hasValidIcd10 && !hasValidSnomed) {
      throw new BadRequestError(
        "No complete ICD-10 or Snomed coding found for condition",
        undefined,
        additionalInfo
      );
    }
    formattedCondition.code = {
      coding: [
        ...(!!icd10Coding?.code && !!icd10Coding?.display
          ? [
              {
                code: icd10Coding.code,
                system: "http://hl7.org/fhir/sid/icd-10-cm",
                display: icd10Coding.display,
              },
            ]
          : []),
        ...(!!snomedCoding?.code && !!snomedCoding?.display
          ? [
              {
                code: snomedCoding.code,
                system: "http://snomed.info/sct",
                display: snomedCoding.display,
              },
            ]
          : []),
      ],
    };
    const startDate = getConditionStartDate(condition);
    if (startDate) formattedCondition.onsetDateTime = startDate;
    return formattedCondition;
  }

  private formatMedicationRequest(
    medicationRequest: MedicationRequest,
    medicationWithRefs: MedicationWithRefs,
    additionalInfo: Record<string, string | undefined>
  ): MedicationRequest {
    const formattedMedicationRequest: MedicationRequest = {
      resourceType: "MedicationRequest",
      ...(medicationRequest.id ? { id: medicationRequest.id } : {}),
      ...(medicationRequest.subject ? { subject: medicationRequest.subject } : {}),
      ...(medicationRequest.meta ? { meta: medicationRequest.meta } : {}),
      ...(medicationRequest.statusReason ? { statusReason: medicationRequest.statusReason } : {}),
    };
    if (!medicationRequest.status) {
      throw new BadRequestError("No status found for MedicationRequest", undefined, additionalInfo);
    }
    formattedMedicationRequest.status = medicationRequest.status;
    if (!medicationRequest.intent) {
      throw new BadRequestError("No intent found for MedicationRequest", undefined, additionalInfo);
    }
    formattedMedicationRequest.intent = medicationRequest.intent;
    const medicationCodeableConcept = medicationWithRefs.medication.code;
    if (!medicationCodeableConcept) {
      throw new BadRequestError(
        "No medicationCodeableConcept found for MedicationRequest",
        undefined,
        additionalInfo
      );
    }
    formattedMedicationRequest.medicationCodeableConcept = medicationCodeableConcept;
    const dosageInstruction =
      medicationWithRefs.statement[0]?.dosage ??
      medicationWithRefs.dispense[0]?.dosageInstruction ??
      medicationRequest.dosageInstruction;
    if (dosageInstruction) {
      formattedMedicationRequest.dosageInstruction = dosageInstruction;
    }
    return formattedMedicationRequest;
  }

  private createFhirPath(resourceType: string, resourceId?: string): string {
    return `fhir-resources-${resourceType}${resourceId ? `/resourceId/${resourceId}` : ""}`;
  }

  async getBundleByResourceType({
    cxId,
    metriportPatientId,
    practicefusionPatientId,
    resourceType,
    useCachedBundle = true,
  }: {
    cxId: string;
    metriportPatientId: string;
    practicefusionPatientId: string;
    resourceType: string;
    useCachedBundle?: boolean;
  }): Promise<Bundle> {
    const { log, debug } = out(
      `PracticeFusion getBundleByResourceType - cxId ${cxId} practiceId ${this.practiceId} practicefusionPatientId ${practicefusionPatientId}`
    );
    if (!isSupportedPracticeFusionResource(resourceType)) {
      throw new BadRequestError("Invalid resource type", undefined, {
        resourceType,
      });
    }
    const params = {
      patient: practicefusionPatientId,
      _count: defaultCountOrLimit.toString(),
    };
    const urlParams = new URLSearchParams(params);
    const resourceTypeUrl = `/${resourceType}?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId: practicefusionPatientId,
      resourceType,
    };
    const client = this; // eslint-disable-line @typescript-eslint/no-this-alias
    function fetchResourcesFromEhr() {
      return fetchEhrFhirResourcesWithPagination({
        makeRequest: async (url: string) => {
          let bundle: EhrFhirResourceBundle | undefined;
          try {
            bundle = await client.makeRequest<EhrFhirResourceBundle>({
              cxId,
              patientId: practicefusionPatientId,
              s3Path: client.createFhirPath(resourceType),
              method: "GET",
              url,
              schema: ehrFhirResourceBundleSchema,
              additionalInfo,
              debug,
              useFhir: true,
            });
          } catch (error) {
            if (error instanceof NotFoundError) {
              log(`Error while fetching ${resourceType} from EHR: ${errorToString(error)}`);
              return undefined;
            }
            throw error;
          }
          if (!bundle) return undefined;
          return convertEhrBundleToValidEhrStrictBundle(
            bundle,
            resourceType,
            practicefusionPatientId
          );
        },
        url: resourceTypeUrl,
      });
    }
    const bundle = await fetchEhrBundleUsingCache({
      ehr: EhrSources.practicefusion,
      cxId,
      metriportPatientId,
      ehrPatientId: practicefusionPatientId,
      resourceType,
      fetchResourcesFromEhr,
      useCachedBundle,
    });
    return bundle;
  }

  async getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    practicefusionPatientId,
    resourceType,
    resourceId,
    useCachedBundle = true,
  }: {
    cxId: string;
    metriportPatientId: string;
    practicefusionPatientId: string;
    resourceType: string;
    resourceId: string;
    useCachedBundle?: boolean;
  }): Promise<Bundle> {
    const { log, debug } = out(
      `PracticeFusion getResourceBundleByResourceId - cxId ${cxId} practiceId ${this.practiceId} metriportPatientId ${metriportPatientId} practicefusionPatientId ${practicefusionPatientId} resourceType ${resourceType}`
    );
    if (
      !isSupportedPracticeFusionResource(resourceType) &&
      !isSupportedPracticeFusionReferenceResource(resourceType)
    ) {
      throw new BadRequestError("Invalid resource type", undefined, {
        practicefusionPatientId,
        resourceId,
        resourceType,
      });
    }
    const params = { _id: resourceId };
    const urlParams = new URLSearchParams(params);
    const resourceTypeUrl = `/${resourceType}?${urlParams.toString()}`;
    const additionalInfo = {
      cxId,
      practiceId: this.practiceId,
      patientId: practicefusionPatientId,
      resourceType,
      resourceId,
    };
    const client = this; // eslint-disable-line @typescript-eslint/no-this-alias
    function fetchResourcesFromEhr() {
      return fetchEhrFhirResourcesWithPagination({
        makeRequest: async (url: string) => {
          let bundle: EhrFhirResourceBundle | undefined;
          try {
            bundle = await client.makeRequest<EhrFhirResourceBundle>({
              cxId,
              patientId: practicefusionPatientId,
              s3Path: client.createFhirPath(resourceType, resourceId),
              method: "GET",
              url,
              schema: ehrFhirResourceBundleSchema,
              additionalInfo,
              debug,
              useFhir: true,
            });
          } catch (error) {
            if (error instanceof NotFoundError) {
              log(`Error while fetching ${resourceType} from EHR: ${errorToString(error)}`);
              return undefined;
            }
            throw error;
          }
          if (!bundle) return undefined;
          return convertEhrBundleToValidEhrStrictBundle(
            bundle,
            resourceType,
            practicefusionPatientId
          );
        },
        url: resourceTypeUrl,
      });
    }
    const bundle = await fetchEhrBundleUsingCache({
      ehr: EhrSources.practicefusion,
      cxId,
      metriportPatientId,
      ehrPatientId: practicefusionPatientId,
      resourceType,
      resourceId,
      fetchResourcesFromEhr,
      useCachedBundle,
    });
    return bundle;
  }
}

export default PracticeFusionApi;
