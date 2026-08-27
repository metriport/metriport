import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { findOrCreateCxMapping } from "../../../../command/mapping/cx";
import { findOrCreateFacilityMapping } from "../../../../command/mapping/facility";
import { createFacilityStateExternalId } from "../../shared/utils/patient";

const athenaOnePracticeIdPrefix = "a-1.Practice-";

/**
 * Command to setup a cx to work with AthenaHealth.
 *
 * @param cxId - The CX ID.
 * @param facilityId - The facility ID.
 * @param athenaOnePracticeId - The AthenaHealth Practice ID (either numeric like 1234 or alphanumeric like a-1.Practice-1234).
 * @param state2LetterCode - The 2 letter state code. Optional.
 */
export async function setupAthenaHealth({
  cxId,
  facilityId,
  athenaOnePracticeId: athenaOnePracticeIdParam,
  state2LetterCode,
}: {
  cxId: string;
  facilityId: string;
  athenaOnePracticeId: string;
  state2LetterCode?: string | undefined;
}) {
  const athenaOnePracticeId = appendPrefixToPracticeIdIfNotPresent(athenaOnePracticeIdParam);

  if (state2LetterCode) {
    const athenaOnePracticeIdWithState = createFacilityStateExternalId(
      athenaOnePracticeId,
      state2LetterCode
    );
    await findOrCreateFacilityMapping({
      cxId,
      facilityId,
      externalId: athenaOnePracticeIdWithState,
      source: EhrSources.athena,
    });
  } else {
    await findOrCreateFacilityMapping({
      cxId,
      facilityId,
      externalId: athenaOnePracticeId,
      source: EhrSources.athena,
    });
  }

  await findOrCreateCxMapping({
    cxId,
    source: EhrSources.athena,
    externalId: athenaOnePracticeId,
    secondaryMappings: { departmentIds: [] },
  });
}

function appendPrefixToPracticeIdIfNotPresent(athenaOnePracticeId: string) {
  if (athenaOnePracticeId.startsWith(athenaOnePracticeIdPrefix)) {
    return athenaOnePracticeId;
  }
  return `${athenaOnePracticeIdPrefix}${athenaOnePracticeId}`;
}
