import { isEhrSourceWithClientCredentials } from "@metriport/core/external/ehr/environment";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { getTwoLeggedClientWithTokenIdAndEnvironment } from "./get-two-legged-client";

/**
 * Get the token id from a new client with client credentials. Returns undefined if the EHR does not support two-legged auth.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice id of the EHR integration.
 * @returns The token id.
 */
export async function getTokenIdFromClientWithClientCredentials({
  ehr,
  cxId,
  practiceId,
}: {
  ehr: EhrSource;
  cxId: string;
  practiceId: string;
}): Promise<string | undefined> {
  if (!isEhrSourceWithClientCredentials(ehr)) return undefined;
  const clientWithTokenIdAndEnvironment = await getTwoLeggedClientWithTokenIdAndEnvironment({
    ehr,
    cxId,
    practiceId,
  });
  return clientWithTokenIdAndEnvironment.tokenId;
}
