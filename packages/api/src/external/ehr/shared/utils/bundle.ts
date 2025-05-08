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

export type FetchBundleParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  resourceType?: SupportedResourceType;
};

export type FetchBundleParamsResourceDiff = FetchBundleParams & {
  bundleType: BundleType;
  jobId: string;
};

type FetchBundleClientParams = {
  metriportPatientId: string;
  resourceType: SupportedResourceType;
};

export type FetchBundleParamsFromClient = FetchBundleParams & FetchBundleClientParams;

export type FetchBundleParamsResourceDiffFromClient = FetchBundleParamsResourceDiff &
  FetchBundleClientParams;

export type FetchBundlePreSignedUrls = {
  preSignedUrls: string[];
  resourceTypes: SupportedResourceType[];
};

export async function validateAndPrepareBundleFetch({
  ehr,
  cxId,
  patientId,
  resourceType,
  supportedResourceTypes,
}: Pick<FetchBundleParams, "ehr" | "cxId" | "patientId" | "resourceType"> & {
  supportedResourceTypes: SupportedResourceType[];
}): Promise<
  FetchBundlePreSignedUrls & {
    metriportPatientId: string;
  }
> {
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
  refreshBundle: (params: FetchBundleParamsFromClient) => Promise<void>;
  fetchBundlePreSignedUrl: (
    params: FetchBundleParamsFromClient | FetchBundleParamsResourceDiffFromClient
  ) => Promise<string | undefined>;
  getSupportedResourceTypes: () => SupportedResourceType[];
};

const bundleFunctionsByEhr: Record<EhrSources, BundleFunctions | undefined> = {
  [EhrSources.canvas]: {
    refreshBundle: async params => {
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
    getSupportedResourceTypes: () => getSupportedResourcesByEhr(EhrSources.canvas),
  },
  [EhrSources.athena]: {
    refreshBundle: async params => {
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
    getSupportedResourceTypes: () => getSupportedResourcesByEhr(EhrSources.athena),
  },
  [EhrSources.elation]: {
    refreshBundle: async params => {
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

export type ContributeEhrOnlyBundleParams = {
  ehr: EhrSources;
  cxId: string;
  practiceId: string;
  patientId: string;
  jobId: string;
};
