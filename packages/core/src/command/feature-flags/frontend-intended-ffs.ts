import { getFeatureFlagValueCxValues } from "./domain-ffs";
import {
  CxFeatureFlagsResponse,
  FrontendIntendedFFs,
  frontendIntendedFFsSchema,
  FrontendIntendedReadableFlagNames,
} from "./types";

/**
 * Returns a mapping of frontend intended feature flags to both their original flag names and
 * their readable equivalents, for a given CX ID.
 * @param cxId - The customer experience (CX) ID to retrieve feature flags for.
 * @returns An object with **ENABLED ONLY** flags.
 */
export async function getFrontendIntendedFFsMapped(cxId: string): Promise<CxFeatureFlagsResponse> {
  const ffs = await getFeatureFlagValueCxValues(cxId, getFrontendIntendedFFs());
  return Object.entries(ffs).reduce((acc, [flagName, data]) => {
    const readableFlagName = mapToReadableFlagNames(flagName as keyof FrontendIntendedFFs);
    return data.ffEnabled && data.cxInFFValues
      ? {
          ...acc,
          [flagName]: data.cxInFFValues,
          ...(readableFlagName ? { [readableFlagName]: data.cxInFFValues } : {}),
        }
      : acc;
  }, {});
}

function getFrontendIntendedFFs(): (keyof FrontendIntendedFFs)[] {
  return frontendIntendedFFsSchema.keyof().options;
}

function mapToReadableFlagNames(
  flagName: keyof FrontendIntendedFFs
): FrontendIntendedReadableFlagNames | undefined {
  switch (flagName) {
    case "cxsWithDashV2FeatureFlag":
      return "shouldShowDashV2";
    case "cxsWithLegacyDashV1FeatureFlag":
      return "shouldShowLegacyDashV1";
    default:
      return undefined;
  }
}
