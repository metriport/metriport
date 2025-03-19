import { Bundle, Observation } from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";
import dayjs from "dayjs";

/**
 * Represents a social history item with necessary information for comparison
 */
export interface SocialHistoryItem {
  id: string;
  name: string;
  code: string;
  system: string;
  date?: string;
  value?: string;
}

/**
 * Structure for summary of a specific source's social history data
 */
export interface SocialHistorySourceSummary {
  count: number;
  socialHistories: SocialHistoryItem[];
  socialHistoriesInLastYear: SocialHistoryItem[];
  uniqueCount: number;
  uniqueSocialHistories: SocialHistoryItem[];
}

/**
 * Structure for the combined summary of social history data from both sources
 */
export interface SocialHistorySummary {
  metriport: SocialHistorySourceSummary;
  zus: SocialHistorySourceSummary;
  common: {
    count: number;
  };
}

/**
 * Extracts social history items from a FHIR bundle
 */
export const extractSocialHistories = (bundle: Bundle): SocialHistoryItem[] => {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter(entry => {
      const resource = entry.resource;
      if (!resource || resource.resourceType !== "Observation" || shouldFilterResource(resource))
        return false;

      // Check if this is a social history observation
      const observation = resource as Observation;
      return (
        observation.category?.some(category =>
          category.coding?.some(coding => coding.code === "social-history")
        ) ?? false
      );
    })
    .map(entry => {
      const observation = entry.resource as Observation;
      const coding = observation.code?.coding?.[0];
      const valueCoding = observation.valueCodeableConcept?.coding?.[0];

      // Get the effective date (could be in different formats)
      let date: string | undefined;
      if (observation.effectiveDateTime) {
        date = observation.effectiveDateTime;
      } else if (observation.effectivePeriod?.start) {
        date = observation.effectivePeriod.start;
      }

      // Get the display name from code.text or coding.display
      const name = observation.code?.text || coding?.display || "Unknown";

      // Get the value if present
      const value =
        valueCoding?.display ||
        observation.valueCodeableConcept?.text ||
        observation.valueQuantity?.value?.toString() ||
        observation.valueString ||
        undefined;

      return {
        id: observation.id || entry.fullUrl || "unknown",
        name,
        code: coding?.code || "unknown",
        system: coding?.system || "unknown",
        date,
        value,
      };
    });
};

/**
 * Compares social history items for equivalence
 */
const areSocialHistoriesEquivalent = (
  item1: SocialHistoryItem,
  item2: SocialHistoryItem
): boolean => {
  // Consider social histories equivalent if they have the same code and system
  return item1.code === item2.code && item1.system === item2.system;
};

/**
 * Determines if a social history item is from the last year
 */
const isSocialHistoryFromLastYear = (socialHistory: SocialHistoryItem): boolean => {
  if (!socialHistory.date) return false;
  const socialHistoryDate = dayjs(socialHistory.date);
  const lastYearDate = dayjs().subtract(1, "year");
  return socialHistoryDate.isAfter(lastYearDate);
};

/**
 * Processes social history data from two sources and generates a comparison summary
 */
export const processSocialHistories = (
  metriportBundle: Bundle,
  zusBundle: Bundle
): SocialHistorySummary => {
  const metriportSocialHistories = extractSocialHistories(metriportBundle);
  const zusSocialHistories = extractSocialHistories(zusBundle);

  const uniqueToMetriportSocialHistories = [];
  const metriportSocialHistoriesInLastYear = [];

  const uniqueToZusSocialHistories = [];
  const zusSocialHistoriesInLastYear = [];

  let commonCount = 0;

  // Process Metriport social histories
  for (const metriportSocialHistory of metriportSocialHistories) {
    // Check if from last year
    if (isSocialHistoryFromLastYear(metriportSocialHistory)) {
      metriportSocialHistoriesInLastYear.push(metriportSocialHistory);
    }

    // Check if unique or common
    const isUnique = !zusSocialHistories.some(zusSocialHistory =>
      areSocialHistoriesEquivalent(metriportSocialHistory, zusSocialHistory)
    );

    if (isUnique) {
      uniqueToMetriportSocialHistories.push(metriportSocialHistory);
    } else {
      commonCount++;
    }
  }

  // Process Zus social histories
  for (const zusSocialHistory of zusSocialHistories) {
    // Check if from last year
    if (isSocialHistoryFromLastYear(zusSocialHistory)) {
      zusSocialHistoriesInLastYear.push(zusSocialHistory);
    }

    // Check if unique
    const isUnique = !metriportSocialHistories.some(metriportSocialHistory =>
      areSocialHistoriesEquivalent(metriportSocialHistory, zusSocialHistory)
    );

    if (isUnique) {
      uniqueToZusSocialHistories.push(zusSocialHistory);
    }
  }

  return {
    metriport: {
      count: metriportSocialHistories.length,
      socialHistories: metriportSocialHistories,
      socialHistoriesInLastYear: metriportSocialHistoriesInLastYear,
      uniqueCount: uniqueToMetriportSocialHistories.length,
      uniqueSocialHistories: uniqueToMetriportSocialHistories,
    },
    zus: {
      count: zusSocialHistories.length,
      socialHistories: zusSocialHistories,
      socialHistoriesInLastYear: zusSocialHistoriesInLastYear,
      uniqueCount: uniqueToZusSocialHistories.length,
      uniqueSocialHistories: uniqueToZusSocialHistories,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Groups social history items by year
 */
const groupSocialHistoriesByYear = (
  socialHistories: SocialHistoryItem[]
): Record<string, SocialHistoryItem[]> => {
  const result: Record<string, SocialHistoryItem[]> = {};

  // Sort by date (most recent first)
  const sortedSocialHistories = [...socialHistories].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Group by year
  sortedSocialHistories.forEach(item => {
    const year = item.date ? new Date(item.date).getFullYear().toString() : "Unknown";
    if (!result[year]) {
      result[year] = [];
    }
    result[year].push(item);
  });

  return result;
};

/**
 * Formats social history items grouped by year
 */
const formatSocialHistoriesByYear = (
  socialHistoriesByYear: Record<string, SocialHistoryItem[]>
): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(socialHistoriesByYear).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return parseInt(b) - parseInt(a);
  });

  years.forEach(year => {
    result += `**${year}**\n\n`;

    socialHistoriesByYear[year].forEach(item => {
      result += `- ${item.name}`;
      if (item.value) {
        result += `: ${item.value}`;
      }
      result += "\n";
    });

    result += "\n";
  });

  return result;
};

/**
 * Formats the social history summary in a question-answer format
 */
export const formatSocialHistorySummary = (summary: SocialHistorySummary): string => {
  let result = "";
  const currentDate = new Date();
  const lastYearDate = new Date();
  lastYearDate.setFullYear(currentDate.getFullYear() - 1);

  // Filter social histories from the last year
  const lastYearMetriportSocialHistories = summary.metriport.socialHistories.filter(
    socialHistory => {
      if (!socialHistory.date) return false;
      const socialHistoryDate = new Date(socialHistory.date);
      return socialHistoryDate >= lastYearDate;
    }
  );

  const lastYearZusSocialHistories = summary.zus.socialHistories.filter(socialHistory => {
    if (!socialHistory.date) return false;
    const socialHistoryDate = new Date(socialHistory.date);
    return socialHistoryDate >= lastYearDate;
  });

  // Calculate totals and differences
  const lastYearMetriportCount = lastYearMetriportSocialHistories.length;
  const lastYearZusCount = lastYearZusSocialHistories.length;
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  // Determine which source had more social histories in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Determine which source had more social histories in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the summary
  result += `**Which source had more social history entries in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of social history entries in the last year (${lastYearMetriportCount}).\n\n`;
  } else {
    result += `${moreLastYear} had more social history entries in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;
  }

  result += `**Which source had more social history entries in total?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of social history entries (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more total social history entries (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique social histories from both sources
  result += `**Social history entries unique to each source:**\n\n`;

  // Show unique Metriport social histories
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} social history entries that were not found in Zus:**\n\n`;
    const uniqueMetriportSocialHistoriesByYear = groupSocialHistoriesByYear(
      summary.metriport.uniqueSocialHistories
    );
    result += formatSocialHistoriesByYear(uniqueMetriportSocialHistoriesByYear);
  } else {
    result += `**Metriport had no unique social history entries (all matched in Zus)**\n\n`;
  }

  // Show unique Zus social histories
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} social history entries that were not found in Metriport:**\n\n`;
    const uniqueZusSocialHistoriesByYear = groupSocialHistoriesByYear(
      summary.zus.uniqueSocialHistories
    );
    result += formatSocialHistoriesByYear(uniqueZusSocialHistoriesByYear);
  } else {
    result += `**Zus had no unique social history entries (all matched in Metriport)**\n\n`;
  }

  result += `**Common social history entries found in both sources: ${summary.common.count}**\n\n`;

  return result;
};
