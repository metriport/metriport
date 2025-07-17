import {
  EhrClientWithClientCredentials,
  EhrEnv,
  EhrPerPracticeParams,
  EhrSourceWithClientCredentials,
} from "@metriport/core/external/ehr/environment";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { createAthenaClientWithTokenIdAndEnvironment } from "../../../athenahealth/shared";
import { createCanvasClientWithTokenIdAndEnvironment } from "../../../canvas/shared";
import { createElationClientWithTokenIdAndEnvironment } from "../../../elation/shared";

/**
 * Get a new client with token id and environment for the EHRs that support two-legged auth
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice id of the EHR integration.
 * @returns The client with token id and environment.
 */
export async function getTwoLeggedClientWithTokenIdAndEnvironment({
  ehr,
  cxId,
  practiceId,
}: EhrPerPracticeParams & { ehr: EhrSourceWithClientCredentials }): Promise<{
  client: EhrClientWithClientCredentials;
  tokenId: string;
  environment: EhrEnv;
}> {
  const handler = getClientWithTokenIdAndEnvironmentHandler(ehr);
  return await handler({ cxId, practiceId });
}

type GetClientWithTokenIdAndEnvironmentFn<
  Client extends EhrClientWithClientCredentials,
  Env extends EhrEnv
> = (
  params: EhrPerPracticeParams
) => Promise<{ client: Client; tokenId: string; environment: Env }>;

type GetClientWithTokenIdAndEnvironmentFnMap = Record<
  EhrSourceWithClientCredentials,
  GetClientWithTokenIdAndEnvironmentFn<EhrClientWithClientCredentials, EhrEnv> | undefined
>;

const clientWithTokenIdAndEnvironmentMethodsBy: GetClientWithTokenIdAndEnvironmentFnMap = {
  [EhrSources.canvas]: createCanvasClientWithTokenIdAndEnvironment,
  [EhrSources.athena]: createAthenaClientWithTokenIdAndEnvironment,
  [EhrSources.elation]: createElationClientWithTokenIdAndEnvironment,
};

function getClientWithTokenIdAndEnvironmentHandler(
  ehr: EhrSourceWithClientCredentials
): GetClientWithTokenIdAndEnvironmentFn<EhrClientWithClientCredentials, EhrEnv> {
  const handler = clientWithTokenIdAndEnvironmentMethodsBy[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to get EHR client", undefined, {
      ehr,
    });
  }
  return handler;
}
