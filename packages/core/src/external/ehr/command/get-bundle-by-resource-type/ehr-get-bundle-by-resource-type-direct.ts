import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getBundleByResourceType as getBundleByResourceTypeCanvas } from "../../canvas/command/get-bundle-by-resource-type";
import {
  EhrGetBundleByResourceTypeHandler,
  GetBundleByResourceTypeClientRequest,
  GetBundleByResourceTypeRequest,
} from "./ehr-get-bundle-by-resource-type";

export class EhrGetBundleByResourceTypeDirect implements EhrGetBundleByResourceTypeHandler {
  async getBundleByResourceType({
    ehr,
    method,
    ...params
  }: GetBundleByResourceTypeRequest): Promise<Bundle> {
    if (!isGetBundleByResourceTypeMethod(method)) {
      throw new BadRequestError(`Invalid get bundle by resource type method`, undefined, {
        method,
      });
    }
    const handler = getEhrGetBundleByResourceTypeHandler(ehr, method);
    return await handler({ ...params });
  }
}

export enum GetBundleByResourceTypeMethods {
  canvasGetBundleByResourceType = "canvasGetBundleByResourceType",
}

function isGetBundleByResourceTypeMethod(method: string): method is GetBundleByResourceTypeMethods {
  return Object.values(GetBundleByResourceTypeMethods).includes(
    method as GetBundleByResourceTypeMethods
  );
}

export type GetBundleByResourceTypeMethodsMap = Record<
  string,
  Record<string, (params: GetBundleByResourceTypeClientRequest) => Promise<Bundle>>
>;

export const ehrGetBundleByResourceTypeMap: GetBundleByResourceTypeMethodsMap = {
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
