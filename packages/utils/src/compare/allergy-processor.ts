import { AllergyIntolerance, Bundle } from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";
import dayjs from "dayjs";

/**
 * Represents an allergy with its display information
 */
interface AllergyInfo {
  display: string;
  date?: string;
  source: "Metriport" | "Zus";
}

/**
 * Represents the summary of allergies by source
 */
interface AllergySummary {
  metriport: {
    count: number;
    allergies: AllergyInfo[];
    allergiesInLastYear: AllergyInfo[];
    uniqueCount: number;
    uniqueAllergies: AllergyInfo[];
  };
  zus: {
    count: number;
    allergies: AllergyInfo[];
    allergiesInLastYear: AllergyInfo[];
    uniqueCount: number;
    uniqueAllergies: AllergyInfo[];
  };
  common: {
    count: number;
  };
}

/**
 * Determines if an allergy should be ignored based on its coding
 */
const shouldIgnoreAllergy = (allergy: AllergyIntolerance): boolean => {
  // Check Zus-style coding in the code property
  const codingValues = allergy.code?.coding?.map(c => c.code) ?? [];

  // Check Metriport-style coding in the reaction manifestations
  const substanceCodes: string[] = [];
  allergy.reaction?.forEach(reaction => {
    reaction.substance?.coding?.forEach(coding => {
      substanceCodes.push(coding.code ?? "");
    });
  });

  const allCodes = [...codingValues, ...substanceCodes];

  return allCodes.some(
    code =>
      code === "UNK" ||
      code === "NA" ||
      code === "NI" ||
      code === "N/A" ||
      code === "NKA" ||
      code === "unknown" ||
      code === "OTH" ||
      code === "not applicable"
  );
};

/**
 * Normalizes allergy text for consistent comparison
 */
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

/**
 * Extracts display text for an allergy from Metriport data
 */
const getMetriportAllergyDisplay = (allergy: AllergyIntolerance): { substance: string } => {
  let substance = "Unknown allergy";

  // Simplified logic - check in order of priority
  if (allergy.reaction?.[0]?.substance?.text) {
    substance = allergy.reaction[0].substance.text;
  } else if (allergy.reaction?.[0]?.substance?.coding?.[0]?.display) {
    substance = allergy.reaction[0].substance.coding[0].display;
  } else if (allergy.code?.text) {
    substance = allergy.code.text;
  } else if (allergy.code?.coding?.[0]?.display) {
    substance = allergy.code.coding[0].display;
  } else if (allergy.code?.coding?.[0]?.code) {
    substance = allergy.code.coding[0].code;
  }

  return { substance };
};

/**
 * Extracts display text for an allergy from Zus data
 */
const getZusAllergyDisplay = (allergy: AllergyIntolerance): string => {
  // Try to get text display
  if (allergy.code?.text) {
    return allergy.code.text;
  }

  // Try to get from coding display
  if (allergy.code?.coding?.[0]?.display) {
    return allergy.code.coding[0].display;
  }

  // Fallback to code
  if (allergy.code?.coding?.[0]?.code) {
    return allergy.code.coding[0].code;
  }

  return "Unknown allergy";
};

/**
 * Generic function to process allergies from a bundle
 */
const processAllergiesFromBundle = (
  bundle: Bundle,
  getDisplay: (allergy: AllergyIntolerance) => string | { substance: string },
  source: "Metriport" | "Zus"
): AllergyInfo[] => {
  const allergies: AllergyInfo[] = [];
  const processedSubstances = new Set<string>();

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;
    if (resource?.resourceType !== "AllergyIntolerance" || shouldFilterResource(resource)) return;

    const allergy = resource as AllergyIntolerance;
    if (shouldIgnoreAllergy(allergy)) return;

    const displayResult = getDisplay(allergy);
    const display = typeof displayResult === "string" ? displayResult : displayResult.substance;
    const normalizedSubstance = normalizeText(display);

    if (processedSubstances.has(normalizedSubstance)) return;

    processedSubstances.add(normalizedSubstance);
    allergies.push({
      display,
      date: allergy.onsetDateTime,
      source,
    });
  });

  return allergies;
};

/**
 * Processes allergies from a Metriport bundle
 */
const processMetriportAllergies = (bundle: Bundle): AllergyInfo[] =>
  processAllergiesFromBundle(bundle, getMetriportAllergyDisplay, "Metriport");

/**
 * Processes allergies from a Zus bundle
 */
const processZusAllergies = (bundle: Bundle): AllergyInfo[] =>
  processAllergiesFromBundle(bundle, getZusAllergyDisplay, "Zus");

/**
 * Determines if two allergies are similar based on display text and date
 */
const areAllergiesSimilar = (allergy1: AllergyInfo, allergy2: AllergyInfo): boolean => {
  // Create normalized versions of display text for comparison
  const display1 = normalizeText(allergy1.display);
  const display2 = normalizeText(allergy2.display);

  // Direct equality is the fastest check
  if (display1 === display2) return true;

  // Compare dates with normalization
  const areDatesMatching = (): boolean => {
    // If both have dates, check if they match within a 24-hour period
    if (allergy1.date && allergy2.date) {
      const date1 = dayjs(allergy1.date);
      const date2 = dayjs(allergy2.date);

      // Check if dates are within 24 hours of each other
      return Math.abs(date1.diff(date2, "hour")) <= 24;
    }

    // If only one has a date, they can't be matched by date
    if ((allergy1.date && !allergy2.date) || (!allergy1.date && allergy2.date)) {
      return false;
    }

    // If neither has a date, we can't use dates to match
    return true;
  };

  // Calculate text similarity using Jaccard index
  const getTextSimilarity = (): number => {
    const words1 = new Set(display1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(display2.split(/\s+/).filter(w => w.length > 2));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  };

  // Quick substring check
  if (display1.includes(display2) || display2.includes(display1)) return true;

  // If dates match, check if texts are similar enough
  if (areDatesMatching()) {
    const textSimilarity = getTextSimilarity();
    return textSimilarity >= 0.4; // Lower threshold when dates match
  }

  // If display texts are highly similar even without matching dates
  const textSimilarity = getTextSimilarity();
  return textSimilarity >= 0.8; // Higher threshold when dates don't match
};

const isAllergyFromLastYear = (allergy: AllergyInfo): boolean => {
  if (!allergy.date) return false;
  const allergyDate = dayjs(allergy.date);
  const lastYearDate = dayjs().subtract(1, "year");
  return allergyDate.isAfter(lastYearDate);
};

/**
 * Processes allergies from both Metriport and Zus bundles
 */
export const processAllergies = (metriportBundle?: Bundle, zusBundle?: Bundle): AllergySummary => {
  // Process allergies for each source only if the bundle exists
  const metriportAllergies = metriportBundle ? processMetriportAllergies(metriportBundle) : [];
  const zusAllergies = zusBundle ? processZusAllergies(zusBundle) : [];

  const uniqueToMetriportAllergies = [];
  const metriportAllergiesInLastYear = [];

  const uniqueToZusAllergies = [];
  const zusAllergiesInLastYear = [];

  let commonCount = 0;

  // Process Metriport allergies
  for (const metriportAllergy of metriportAllergies) {
    // Check if from last year
    if (isAllergyFromLastYear(metriportAllergy)) {
      metriportAllergiesInLastYear.push(metriportAllergy);
    }

    // Check if unique or common
    const isUnique = !zusAllergies.some(zusAllergy =>
      areAllergiesSimilar(metriportAllergy, zusAllergy)
    );

    if (isUnique) {
      uniqueToMetriportAllergies.push(metriportAllergy);
    } else {
      commonCount++;
    }
  }

  // Process Zus allergies
  for (const zusAllergy of zusAllergies) {
    // Check if from last year
    if (isAllergyFromLastYear(zusAllergy)) {
      zusAllergiesInLastYear.push(zusAllergy);
    }

    // Check if unique (we already counted common allergies above)
    const isUnique = !metriportAllergies.some(metriportAllergy =>
      areAllergiesSimilar(metriportAllergy, zusAllergy)
    );

    if (isUnique) {
      uniqueToZusAllergies.push(zusAllergy);
    }
  }

  return {
    metriport: {
      count: metriportAllergies.length,
      allergies: metriportAllergies,
      allergiesInLastYear: metriportAllergiesInLastYear,
      uniqueCount: uniqueToMetriportAllergies.length,
      uniqueAllergies: uniqueToMetriportAllergies,
    },
    zus: {
      count: zusAllergies.length,
      allergies: zusAllergies,
      allergiesInLastYear: zusAllergiesInLastYear,
      uniqueCount: uniqueToZusAllergies.length,
      uniqueAllergies: uniqueToZusAllergies,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Formats the allergy summary in a question-answer format
 */
export const formatAllergySummary = (summary: AllergySummary): string => {
  let result = "";

  // Calculate totals
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  const lastYearMetriportCount = summary.metriport.allergiesInLastYear.length;
  const lastYearZusCount = summary.zus.allergiesInLastYear.length;

  // Determine which source had more allergies in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Determine which source had more allergies in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the results as questions and answers
  result += "### Comparing Allergies between Metriport and Zus\n\n";

  result += `**Which source had more allergies in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of allergies (${lastYearMetriportCount}) in the last year.\n\n`;
  } else {
    result += `${moreLastYear} had more allergies in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;
  }

  result += `**Which source had more allergies in total?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of allergies (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more total allergies (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique allergies from both sources
  result += `**Allergies unique to each source:**\n\n`;

  // Show unique Metriport allergies
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} allergies that were not found in Zus:**\n\n`;
    const uniqueMetriportAllergiesByYear = groupAllergiesByYear(summary.metriport.uniqueAllergies);
    result += formatAllergiesByYear(uniqueMetriportAllergiesByYear);
  } else {
    result += `**Metriport had no unique allergies (all matched in Zus)**\n\n`;
  }

  // Show unique Zus allergies
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} allergies that were not found in Metriport:**\n\n`;
    const uniqueZusAllergiesByYear = groupAllergiesByYear(summary.zus.uniqueAllergies);
    result += formatAllergiesByYear(uniqueZusAllergiesByYear);
  } else {
    result += `**Zus had no unique allergies (all matched in Metriport)**\n\n`;
  }

  result += `**Common allergies found in both sources: ${summary.common.count}**\n\n`;

  return result;
};

/**
 * Groups allergies by year and sorts them in descending order by date
 */
const groupAllergiesByYear = (allergies: AllergyInfo[]): Record<string, AllergyInfo[]> => {
  // Sort allergies by date (most recent first)
  const sortedAllergies = [...allergies].sort((a, b) => {
    // If no dates are available, keep original order
    if (!a.date && !b.date) return 0;
    // Items with no date go last
    if (!a.date) return 1;
    if (!b.date) return -1;
    // Sort descending by date
    return b.date.localeCompare(a.date);
  });

  // Group by year
  const allergiesByYear: Record<string, AllergyInfo[]> = {};

  sortedAllergies.forEach(allergy => {
    let year = "Unknown";

    if (allergy.date) {
      // Extract year from ISO date string (YYYY-MM-DD or YYYY)
      const match = allergy.date.match(/^(\d{4})/);
      if (match) {
        year = match[1];
      }
    }

    if (!allergiesByYear[year]) {
      allergiesByYear[year] = [];
    }

    allergiesByYear[year].push(allergy);
  });

  return allergiesByYear;
};

/**
 * Formats allergies grouped by year
 */
const formatAllergiesByYear = (allergiesByYear: Record<string, AllergyInfo[]>): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(allergiesByYear).sort((a, b) => {
    // "Unknown" year should be last
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    // Otherwise, sort years in descending order
    return b.localeCompare(a);
  });

  years.forEach(year => {
    const yearAllergies = allergiesByYear[year];
    result += `### ${year} (${yearAllergies.length})\n\n`;

    yearAllergies.forEach(allergy => {
      const dateDisplay = allergy.date ? ` (${allergy.date})` : "";
      result += `- ${allergy.display}${dateDisplay}\n`;
    });

    result += "\n";
  });

  return result;
};
