import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { validateAndLogResponse } from "./shared";

interface GetCustomerParams {
  cxId: string;
}

/**
 * Sends a request to the API to get customer data.
 *
 * @param cxId - The CX ID.
 */
export async function getCustomer({ cxId }: GetCustomerParams): Promise<void> {
  const { log, debug } = out(`Surescripts getCustomer - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const getCustomerUrl = `/internal/cx-data?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getCustomerUrl);
    });
    return validateAndLogResponse(getCustomerUrl, response, debug);
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
