import { Bundle, Encounter } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { shouldFilterResource } from "./filter-utils";

/**
 * Represents an encounter with its display information
 */
interface EncounterInfo {
  display: string;
  startDate?: string;
  endDate?: string;
  source: "Metriport" | "Zus";
}

/**
 * Represents the summary of encounters by source
 */
interface EncounterSummary {
  metriport: {
    count: number;
    encounters: EncounterInfo[];
    encountersInLastYear: EncounterInfo[];
    uniqueEncounters: EncounterInfo[];
  };
  zus: {
    count: number;
    encounters: EncounterInfo[];
    encountersInLastYear: EncounterInfo[];
    uniqueEncounters: EncounterInfo[];
  };
  common: {
    count: number;
  };
}

/**
 * Processes encounters from both Metriport and Zus bundles
 */
export const processEncounters = (metriportBundle: Bundle, zusBundle: Bundle): EncounterSummary => {
  const metriportEncounters = processBundleEncounters(metriportBundle, "Metriport");
  const zusEncounters = processBundleEncounters(zusBundle, "Zus");

  const uniqueToMetriportEncounters = [];
  const metriportEncountersInLastYear = [];

  const uniqueToZusEncounters = [];
  const zusEncountersInLastYear = [];

  const commonEncounters = [];

  for (const metriportEncounter of metriportEncounters) {
    if (isEncounterFromLastYear(metriportEncounter)) {
      metriportEncountersInLastYear.push(metriportEncounter);
    }

    const isUnique = !zusEncounters.some(zusEncounter =>
      areEncountersSimilar(metriportEncounter, zusEncounter)
    );
    if (isUnique) {
      uniqueToMetriportEncounters.push(metriportEncounter);
    } else {
      commonEncounters.push(metriportEncounter);
    }
  }

  for (const zusEncounter of zusEncounters) {
    if (isEncounterFromLastYear(zusEncounter)) {
      zusEncountersInLastYear.push(zusEncounter);
    }

    const isUnique = !metriportEncounters.some(metriportEncounter =>
      areEncountersSimilar(metriportEncounter, zusEncounter)
    );
    if (isUnique) {
      uniqueToZusEncounters.push(zusEncounter);
    }
  }

  return {
    metriport: {
      count: metriportEncounters.length,
      encounters: metriportEncounters,
      encountersInLastYear: metriportEncountersInLastYear,
      uniqueEncounters: uniqueToMetriportEncounters,
    },
    zus: {
      count: zusEncounters.length,
      encounters: zusEncounters,
      encountersInLastYear: zusEncountersInLastYear,
      uniqueEncounters: uniqueToZusEncounters,
    },
    common: {
      count: commonEncounters.length,
    },
  };
};

const processBundleEncounters = (bundle: Bundle, type: "Metriport" | "Zus"): EncounterInfo[] => {
  const encounters: EncounterInfo[] = [];

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;

    if (resource?.resourceType !== "Encounter" || shouldFilterResource(resource)) {
      return;
    }

    const encounter = resource as Encounter;
    const { startDate, endDate } = getEncounterDates(encounter);

    const encounterInfo = {
      display: getEncounterDisplay(encounter),
      startDate,
      endDate,
      source: type,
    };

    encounters.push(encounterInfo);
  });

  return encounters;
};

/**
 * Extracts display text for an encounter from Metriport data
 */
const getEncounterDisplay = (encounter: Encounter): string => {
  // Try to get from type coding display first
  if (encounter.type?.some(t => t.coding?.some(c => c.display))) {
    for (const typeItem of encounter.type || []) {
      const codingWithDisplay = typeItem.coding?.find(c => c.display);
      if (codingWithDisplay?.display && !isUnknownValue(codingWithDisplay.display)) {
        return codingWithDisplay.display;
      }
    }
  }

  // Try to get from class display
  if (encounter.class?.display && !isUnknownValue(encounter.class.display)) {
    return encounter.class.display;
  }

  // Try to get from class code
  if (encounter.class?.code && !isUnknownValue(encounter.class.code)) {
    return encounter.class.code;
  }

  // Try to get from type text
  if (encounter.type?.some(t => t.text)) {
    const typeWithText = encounter.type.find(t => t.text && !isUnknownValue(t.text));
    if (typeWithText?.text) {
      return typeWithText.text;
    }
  }

  // Try to get from reasonCode text
  if (encounter.reasonCode?.some(r => r.text)) {
    const reasonWithText = encounter.reasonCode.find(r => r.text && !isUnknownValue(r.text));
    if (reasonWithText?.text) {
      return reasonWithText.text;
    }
  }

  return "";
};

/**
 * Checks if a value represents an unknown or placeholder value
 */
const isUnknownValue = (value: string): boolean => {
  const normalizedValue = value.toLowerCase().trim();
  const unknownPatterns = [
    "unknown",
    "unspecified",
    "not specified",
    "no information",
    "n/a",
    "none",
    "null",
    "undefined",
  ];

  return unknownPatterns.some(pattern => normalizedValue.includes(pattern));
};

/**
 * Gets the start and end dates from an encounter
 */
const getEncounterDates = (encounter: Encounter): { startDate?: string; endDate?: string } => {
  return {
    startDate: encounter.period?.start,
    endDate: encounter.period?.end,
  };
};

/**
 * Determines if two encounters are similar based on display text and dates
 */
const areEncountersSimilar = (encounter1: EncounterInfo, encounter2: EncounterInfo): boolean => {
  // Create normalized versions of display text for comparison
  const normalizeText = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

  const display1 = normalizeText(encounter1.display);
  const display2 = normalizeText(encounter2.display);

  // Compare dates with normalization
  const areDatesMatching = (): boolean => {
    // If both have start dates, check if they match within a 24-hour period
    if (encounter1.startDate && encounter2.startDate) {
      const date1 = new Date(encounter1.startDate);
      const date2 = new Date(encounter2.startDate);

      // Check if dates are within 24 hours (86400000 ms) of each other
      return Math.abs(date1.getTime() - date2.getTime()) <= 86400000;
    }

    // If only one has a date, they can't be matched by date
    if (
      (encounter1.startDate && !encounter2.startDate) ||
      (!encounter1.startDate && encounter2.startDate)
    ) {
      return false;
    }

    // If neither has a date, we can't use dates to match
    return true;
  };

  // Calculate text similarity using Jaccard index (handles partial matches better)
  const getTextSimilarity = (): number => {
    const words1 = new Set(display1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(display2.split(/\s+/).filter(w => w.length > 2));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  };

  // If display texts are very similar (exact match), they're likely the same encounter
  if (display1 === display2) {
    return areDatesMatching();
  }

  // If dates match, check if texts are similar enough
  if (areDatesMatching()) {
    const textSimilarity = getTextSimilarity();
    return textSimilarity >= 0.4; // Lower threshold when dates match
  }

  // If display texts are highly similar even without matching dates
  const textSimilarity = getTextSimilarity();
  return textSimilarity >= 0.8; // Higher threshold when dates don't match
};

const isEncounterFromLastYear = (encounter: EncounterInfo): boolean => {
  if (!encounter.startDate) return false;
  const encounterDate = dayjs(encounter.startDate);
  const lastYearDate = dayjs().subtract(1, "year");
  return encounterDate.isAfter(lastYearDate);
};

/**
 * Formats the encounter summary as markdown
 */
export const formatEncounterSummary = (summary: EncounterSummary): string => {
  let result = "";

  // Calculate totals
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  const lastYearMetriportCount = summary.metriport.encountersInLastYear.length;
  const lastYearZusCount = summary.zus.encountersInLastYear.length;

  // Determine which source had more encounters in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Determine which source had more encounters in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the results as questions and answers
  result += "### Comparing Encounters between Metriport and Zus\n\n";

  result += `**Which source had more encounters in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of encounters (${lastYearMetriportCount}) in the last year.\n\n`;
  } else {
    result += `${moreLastYear} had more encounters in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;
  }

  result += `**Which source had more encounters in total?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of encounters (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more total encounters (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique encounters from both sources
  result += `**Encounters unique to each source:**\n\n`;

  // Show unique Metriport encounters
  if (summary.metriport.uniqueEncounters.length > 0) {
    result += `**Metriport had ${summary.metriport.uniqueEncounters.length} encounters that were not found in Zus:**\n\n`;
    const uniqueMetriportEncountersByYear = groupEncountersByYear(
      summary.metriport.uniqueEncounters
    );
    result += formatEncountersByYear(uniqueMetriportEncountersByYear);
  } else {
    result += `**Metriport had no unique encounters (all matched in Zus)**\n\n`;
  }

  // Show unique Zus encounters
  if (summary.zus.uniqueEncounters.length > 0) {
    result += `**Zus had ${summary.zus.uniqueEncounters.length} encounters that were not found in Metriport:**\n\n`;
    const uniqueZusEncountersByYear = groupEncountersByYear(summary.zus.uniqueEncounters);
    result += formatEncountersByYear(uniqueZusEncountersByYear);
  } else {
    result += `**Zus had no unique encounters (all matched in Metriport)**\n\n`;
  }

  result += `**Common encounters found in both sources: ${summary.common.count}**\n\n`;

  return result;
};

/**
 * Groups encounters by year and sorts them in descending order by date
 */
const groupEncountersByYear = (encounters: EncounterInfo[]): Record<string, EncounterInfo[]> => {
  // Sort encounters by date (most recent first)
  const sortedEncounters = [...encounters].sort((a, b) => {
    // If no dates are available, keep original order
    if (!a.startDate && !b.startDate) return 0;
    // Items with no date go last
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    // Sort descending by date
    return b.startDate.localeCompare(a.startDate);
  });

  // Group by year
  const encountersByYear: Record<string, EncounterInfo[]> = {};

  sortedEncounters.forEach(encounter => {
    let year = "Unknown";

    if (encounter.startDate) {
      // Extract year from ISO date string (YYYY-MM-DD or YYYY)
      const match = encounter.startDate.match(/^(\d{4})/);
      if (match) {
        year = match[1];
      }
    }

    if (!encountersByYear[year]) {
      encountersByYear[year] = [];
    }

    encountersByYear[year].push(encounter);
  });

  return encountersByYear;
};

/**
 * Formats encounters grouped by year
 */
const formatEncountersByYear = (encountersByYear: Record<string, EncounterInfo[]>): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(encountersByYear).sort((a, b) => {
    // "Unknown" year should be last
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    // Otherwise, sort years in descending order
    return b.localeCompare(a);
  });

  years.forEach(year => {
    const yearEncounters = encountersByYear[year];
    result += `### ${year} (${yearEncounters.length})\n\n`;

    yearEncounters.forEach(encounter => {
      let dateDisplay = "";
      if (encounter.startDate) {
        dateDisplay += ` (${encounter.startDate}`;
        if (encounter.endDate) {
          dateDisplay += ` to ${encounter.endDate}`;
        }
        dateDisplay += ")";
      }

      result += `- ${encounter.display}${dateDisplay}\n`;
    });

    result += "\n";
  });

  return result;
};
