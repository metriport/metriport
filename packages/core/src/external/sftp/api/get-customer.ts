import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios, { AxiosInstance } from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./shared";
import { z } from "zod";

export interface GetCustomerParams {
  cxId: string;
}

const getCustomerResponseSchema = z.object({
  cxId: z.string(),
  facilities: z.array(
    z.object({
      id: z.string(),
      oid: z.string(),
      name: z.string(),
      npi: z.string(),
    })
  ),
});

export type GetCustomerResponse = z.infer<typeof getCustomerResponseSchema>;

/**
 * Sends a request to the API to get customer data.
 *
 * @param cxId - The CX ID.
 */
export async function getCustomer(
  { cxId }: GetCustomerParams,
  axiosInstance?: AxiosInstance
): Promise<GetCustomerResponse> {
  const { log, debug } = out(`Surescripts getCustomer - cxId ${cxId}`);
  const api = axiosInstance ?? axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const getCustomerUrl = `/internal/cx-data?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getCustomerUrl);
    });
    return validateAndLogResponse<GetCustomerResponse>({
      url: getCustomerUrl,
      response,
      schema: getCustomerResponseSchema,
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
