import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { CustomerData, customerDataSchema } from "@metriport/shared/domain/customer";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";

/**
 * Sends an API request to cx-data, which returns the customer's data (facilities)
 *
 * @param params - The customer ID
 * @returns The customer's data
 */
export async function getCustomerData(cxId: string): Promise<CustomerData> {
  const { log, debug } = out(`ss.getCustomer - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const getCustomerUrl = `/internal/cx-data?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getCustomerUrl);
    });
    return validateAndLogResponse<CustomerData>({
      url: getCustomerUrl,
      response,
      schema: customerDataSchema,
      debug,
    });
  } catch (error) {
    const msg = "Failure while getting customer data @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      url: getCustomerUrl,
      context: "surescripts.getCustomer",
    });
  }
}
