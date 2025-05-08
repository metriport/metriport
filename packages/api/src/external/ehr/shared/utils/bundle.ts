import {
  BundleType,
  getSupportedResourcesByEhr,
} from "@metriport/core/external/ehr/bundle/bundle-shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import {
  FhirResource,
  SupportedResourceType,
  fhirResourceSchema,
  getDefaultBundle,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import { FHIRConverterSourceDataType } from "../../../fhir-converter/connector";
import { FHIRConverterCDATemplate } from "../../../fhir-converter/converter";
import { FHIRConverterConnectorHTTP } from "../../../fhir-converter/connector-http";
import { createAthenaClient } from "../../athenahealth/shared";
import { createCanvasClient } from "../../canvas/shared";
import { createElationClient } from "../../elation/shared";

type BaseBundleParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  resourceType?: SupportedResourceType;
};

export type FetchBundleParams = BaseBundleParams & { bundleType: BundleType; jobId?: string };

export type RefreshEhrBundleParams = BaseBundleParams;

export type ContributeEhrOnlyBundleParams = Omit<BaseBundleParams, "resourceType"> & {
  jobId: string;
};

type BaseBundleParamsForClient = Required<BaseBundleParams> & {
  metriportPatientId: string;
};

export type FetchBundleParamsForClient = FetchBundleParams & BaseBundleParamsForClient;

export type RefreshEhrBundleParamsForClient = RefreshEhrBundleParams & BaseBundleParamsForClient;

export type FetchedBundlePreSignedUrls = {
  preSignedUrls: string[];
  resourceTypes: SupportedResourceType[];
};

export async function validateAndPrepareBundleFetchOrRefresh({
  ehr,
  cxId,
  patientId,
  resourceType,
  supportedResourceTypes,
}: Pick<FetchBundleParams, "ehr" | "cxId" | "patientId" | "resourceType"> & {
  supportedResourceTypes: SupportedResourceType[];
}): Promise<FetchedBundlePreSignedUrls & { metriportPatientId: string }> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: patientId,
    source: ehr,
  });
  const metriportPatientId = patientMapping.patientId;
  if (resourceType && !supportedResourceTypes.includes(resourceType)) {
    throw new BadRequestError("Resource type is not supported for bundle", undefined, {
      resourceType,
    });
  }
  const preSignedUrls: string[] = [];
  const resourceTypes = resourceType ? [resourceType] : supportedResourceTypes;
  return { preSignedUrls, resourceTypes, metriportPatientId };
}

export type BundleFunctions = {
  fetchBundlePreSignedUrl: (params: FetchBundleParamsForClient) => Promise<string | undefined>;
  refreshEhrBundle: (params: RefreshEhrBundleParamsForClient) => Promise<void>;
  getSupportedResourceTypes: () => SupportedResourceType[];
};

const bundleFunctionsByEhr: Record<EhrSources, BundleFunctions | undefined> = {
  [EhrSources.canvas]: {
    fetchBundlePreSignedUrl: async params => {
      const canvasApi = await createCanvasClient({
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
      return canvasApi.getBundleByResourceTypePreSignedUrl({
        ...params,
        canvasPatientId: params.patientId,
      });
    },
    refreshEhrBundle: async params => {
      const canvasApi = await createCanvasClient({
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
      await canvasApi.getBundleByResourceType({
        ...params,
        canvasPatientId: params.patientId,
        useCachedBundle: false,
      });
    },
    getSupportedResourceTypes: () => getSupportedResourcesByEhr(EhrSources.canvas),
  },
  [EhrSources.athena]: {
    fetchBundlePreSignedUrl: async params => {
      const athenaApi = await createAthenaClient({
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
      return athenaApi.getBundleByResourceTypePreSignedUrl({
        ...params,
        athenaPatientId: params.patientId,
      });
    },
    refreshEhrBundle: async params => {
      const athenaApi = await createAthenaClient({
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
      await athenaApi.getBundleByResourceType({
        ...params,
        athenaPatientId: params.patientId,
        useCachedBundle: false,
      });
    },
    getSupportedResourceTypes: () => getSupportedResourcesByEhr(EhrSources.athena),
  },
  [EhrSources.elation]: {
    fetchBundlePreSignedUrl: async params => {
      const elationApi = await createElationClient({
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
      return elationApi.getBundleByResourceTypePreSignedUrl({
        ...params,
        elationPatientId: params.patientId,
      });
    },
    refreshEhrBundle: async params => {
      const elationApi = await createElationClient({
        cxId: params.cxId,
        practiceId: params.practiceId,
      });
      await elationApi.getBundleByResourceType({
        ...params,
        elationPatientId: params.patientId,
        ccdaToFhirConverter: async ccda => {
          const connector = new FHIRConverterConnectorHTTP();
          const bundle = await connector.requestConvert({
            cxId: params.cxId,
            patientId: params.patientId,
            documentId: uuidv7(),
            sourceType: FHIRConverterSourceDataType.cda,
            payload: ccda,
            template: FHIRConverterCDATemplate.ccd,
            unusedSegments: "true",
            invalidAccess: "true",
            requestId: uuidv7(),
          });
          const defaultBundle = getDefaultBundle();
          if (!bundle) return defaultBundle;
          const resources: FhirResource[] = (bundle.entry || []).flatMap(e => {
            if (!e.resource) return [];
            const resource = fhirResourceSchema.safeParse(e.resource);
            if (!resource.success) return [];
            return resource.data;
          });
          defaultBundle.entry = resources.map(resource => {
            return { resource };
          });
          return defaultBundle;
        },
        useCachedBundle: false,
      });
    },
    getSupportedResourceTypes: () => getSupportedResourcesByEhr(EhrSources.elation),
  },
  [EhrSources.healthie]: undefined,
};

export function getBundleFunctions(ehr: EhrSources): BundleFunctions {
  const bundleFunctions = bundleFunctionsByEhr[ehr];
  if (!bundleFunctions) {
    throw new BadRequestError("No bundle functions found @ Ehr", undefined, { ehr });
  }
  return bundleFunctions;
}
