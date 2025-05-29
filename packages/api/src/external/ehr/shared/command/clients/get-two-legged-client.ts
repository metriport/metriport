import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { createAthenaClientWithTokenIdAndEnvironment } from "../../../athenahealth/shared";
import { createCanvasClientWithTokenIdAndEnvironment } from "../../../canvas/shared";
import { createElationClientWithTokenIdAndEnvironment } from "../../../elation/shared";
import { EhrClientTwoLeggedClient, EhrEnv, EhrPerPracticeParams } from "../../utils/client";

/**
 * Get the client with token id and environment for the EHRs that support two-legged auth
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice id of the EHR integration.
 */
export async function getTwoLeggedClientWithTokenIdAndEnvironment({
  ehr,
  cxId,
  practiceId,
}: EhrPerPracticeParams & { ehr: TwoLeggedEhrSource }): Promise<{
  client: EhrClientTwoLeggedClient;
  tokenId: string;
  environment: EhrEnv;
}> {
  const handler = getClientWithTokenIdAndEnvironmentHandler(ehr);
  return await handler({ cxId, practiceId });
}

const twoLeggedEhrSources = [EhrSources.canvas, EhrSources.athena, EhrSources.elation] as const;
type TwoLeggedEhrSource = (typeof twoLeggedEhrSources)[number];
export function isTwoLeggedEhrSource(ehr: string): ehr is TwoLeggedEhrSource {
  return twoLeggedEhrSources.includes(ehr as TwoLeggedEhrSource);
}

type GetClientWithTokenIdAndEnvironment<T extends EhrClientTwoLeggedClient, Env extends EhrEnv> = (
  params: EhrPerPracticeParams
) => Promise<{ client: T; tokenId: string; environment: Env }>;

type ClientWithTokenIdAndEnvironmentMethodMap = Record<
  TwoLeggedEhrSource,
  GetClientWithTokenIdAndEnvironment<EhrClientTwoLeggedClient, EhrEnv> | undefined
>;

const clientWithTokenIdAndEnvironmentMethodsBy: ClientWithTokenIdAndEnvironmentMethodMap = {
  [EhrSources.canvas]: createCanvasClientWithTokenIdAndEnvironment,
  [EhrSources.athena]: createAthenaClientWithTokenIdAndEnvironment,
  [EhrSources.elation]: createElationClientWithTokenIdAndEnvironment,
};

function getClientWithTokenIdAndEnvironmentHandler(
  ehr: TwoLeggedEhrSource
): GetClientWithTokenIdAndEnvironment<EhrClientTwoLeggedClient, EhrEnv> {
  const handler = clientWithTokenIdAndEnvironmentMethodsBy[ehr];
  if (!handler) {
    throw new BadRequestError("No client with token id and environment handler found", undefined, {
      ehr,
    });
  }
  return handler;
}
