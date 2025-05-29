import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getBundleByResourceType as getBundleByResourceTypeAthena } from "../../athenahealth/command/get-bundle-by-resource-type";
import { getBundleByResourceType as getBundleByResourceTypeCanvas } from "../../canvas/command/get-bundle-by-resource-type";
import {
  EhrGetBundleByResourceTypeHandler,
  GetBundleByResourceTypeClientRequest,
  GetBundleByResourceTypeRequest,
} from "./ehr-get-bundle-by-resource-type";

export class EhrGetBundleByResourceTypeDirect implements EhrGetBundleByResourceTypeHandler {
  async getBundleByResourceType({
    ehr,
    ...params
  }: GetBundleByResourceTypeRequest): Promise<Bundle> {
    const handler = getEhrGetBundleByResourceTypeHandler(ehr);
    return await handler({ ...params });
  }
}

type GetBundleByResourceType = (params: GetBundleByResourceTypeClientRequest) => Promise<Bundle>;

type GetBundleByResourceTypeMethodsMap = Record<EhrSource, GetBundleByResourceType | undefined>;

const ehrGetBundleByResourceTypeMap: GetBundleByResourceTypeMethodsMap = {
  [EhrSources.canvas]: getBundleByResourceTypeCanvas,
  [EhrSources.athena]: getBundleByResourceTypeAthena,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrGetBundleByResourceTypeHandler(ehr: EhrSource): GetBundleByResourceType {
  const handler = ehrGetBundleByResourceTypeMap[ehr];
  if (!handler) {
    throw new BadRequestError("No get bundle by resource type handler found", undefined, {
      ehr,
    });
  }
  return handler;
}
