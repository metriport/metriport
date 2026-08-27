import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { z } from "zod";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { validateAndLogResponse } from "./api-shared";

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshTokenResult = z.infer<typeof refreshTokenSchema>;

const ehrSourcesWithRefreshToken = [EhrSources.practicefusion] as const;
export type EhrSourceWithRefreshToken = (typeof ehrSourcesWithRefreshToken)[number];

export type GetRefreshTokenParams = {
  practiceId: string;
  ehr: EhrSourceWithRefreshToken;
};

const maskPlaceholder = "********";

/**
 * Sends a request to the API to get the refresh token for a practice.
 * This is used for EHRs that require 3-legged OAuth where the user must authorize first.
 *
 * @param ehr - The EHR source.
 * @param practiceId - The practice ID.
 */
export async function getRefreshToken({
  ehr,
  practiceId,
}: GetRefreshTokenParams): Promise<RefreshTokenResult> {
  const { log, debug } = out(`Ehr getRefreshToken - practiceId ${practiceId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const getRefreshTokenUrl = `/internal/ehr/${ehr}/practice/${practiceId}/refresh-token`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.get(getRefreshTokenUrl);
    });
    validateAndLogResponse(getRefreshTokenUrl, response, debug, maskRefreshToken);
    return refreshTokenSchema.parse(response.data);
  } catch (error) {
    const msg = "Failure while getting refresh token @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      practiceId,
      url: getRefreshTokenUrl,
      context: `ehr.getRefreshToken`,
    });
  }
}

function maskRefreshToken(data: unknown): unknown {
  const result = refreshTokenSchema.safeParse(data);
  if (result.success) {
    const { refreshToken } = result.data;
    const charsToShow =
      refreshToken.length < 7 ? 0 : Math.min(5, Math.floor(refreshToken.length / 3));
    return {
      refreshToken: `${refreshToken.slice(0, charsToShow)}${maskPlaceholder}`,
    };
  }
  return maskPlaceholder;
}
