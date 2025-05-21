import { Bundle } from "@medplum/fhirtypes";
import {
  EhrGetBundleByResourceTypeHandler,
  GetBundleByResourceTypeRequest,
  getEhrGetBundleByResourceTypeHandler,
} from "./ehr-get-bundle-by-resource-type";

export class EhrGetBundleByResourceTypeLocal implements EhrGetBundleByResourceTypeHandler {
  async getBundleByResourceType({
    ehr,
    method,
    ...params
  }: GetBundleByResourceTypeRequest): Promise<Bundle> {
    const handler = getEhrGetBundleByResourceTypeHandler(ehr, method);
    return await handler({ ...params });
  }
}
