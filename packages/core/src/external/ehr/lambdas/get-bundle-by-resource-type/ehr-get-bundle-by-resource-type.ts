import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getBundleByResourceType as getBundleByResourceTypeAthena } from "../../athenahealth/command/get-bundle-by-resource-type";
import { getBundleByResourceType as getBundleByResourceTypeCanvas } from "../../canvas/command/get-bundle-by-resource-type";

export type GetBundleByResourceTypeRequest = {
  ehr: EhrSource;
  environment: string;
  method: GetBundleByResourceTypeMethods;
  tokenId?: string;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  resourceType: string;
  useCachedBundle: boolean;
};

export interface EhrGetBundleByResourceTypeHandler {
  getBundleByResourceType(request: GetBundleByResourceTypeRequest): Promise<Bundle>;
}

export type GetBundleByResourceTypeClientRequest = Omit<
  GetBundleByResourceTypeRequest,
  "ehr" | "method"
>;

export enum GetBundleByResourceTypeMethods {
  canvasGetBundleByResourceType = "canvasGetBundleByResourceType",
  athenaGetBundleByResourceType = "athenaGetBundleByResourceType",
}

export type GetBundleByResourceTypeMethodsMap = Record<
  string,
  Record<string, (params: GetBundleByResourceTypeClientRequest) => Promise<Bundle>>
>;

export const ehrGetBundleByResourceTypeMap: GetBundleByResourceTypeMethodsMap = {
  [EhrSources.athena]: {
    [GetBundleByResourceTypeMethods.athenaGetBundleByResourceType]: getBundleByResourceTypeAthena,
  },
  [EhrSources.canvas]: {
    [GetBundleByResourceTypeMethods.canvasGetBundleByResourceType]: getBundleByResourceTypeCanvas,
  },
};

export function getEhrGetBundleByResourceTypeHandler(
  ehr: EhrSource,
  method: GetBundleByResourceTypeMethods
): (params: GetBundleByResourceTypeClientRequest) => Promise<Bundle> {
  const handler = ehrGetBundleByResourceTypeMap[ehr]?.[method];
  if (!handler) {
    throw new BadRequestError(`No get bundle by resource type handler found`, undefined, {
      ehr,
      method,
    });
  }
  return handler;
}
