import { Bundle, Condition } from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";
import dayjs from "dayjs";

/**
 * Represents a condition with its display information
 */
interface ConditionInfo {
  display: string;
  date?: string;
  source: "Metriport" | "Zus";
  code?: {
    system?: string;
    value: string;
  };
}

/**
 * Represents the summary of conditions by source
 */
interface ConditionSummary {
  metriport: {
    count: number;
    conditions: ConditionInfo[];
    conditionsInLastYear: ConditionInfo[];
    uniqueCount: number;
    uniqueConditions: ConditionInfo[];
  };
  zus: {
    count: number;
    conditions: ConditionInfo[];
    conditionsInLastYear: ConditionInfo[];
    uniqueCount: number;
    uniqueConditions: ConditionInfo[];
  };
  common: {
    count: number;
  };
}

/**
 * Extracts display text for a condition from Metriport data
 */
const getMetriportConditionDisplay = (condition: Condition): string => {
  // Try to get text from code.text first
  if (condition.code?.text) {
    return condition.code.text;
  }

  // Try to get from coding display
  if (condition.code?.coding?.some(coding => coding.display)) {
    const displayCoding = condition.code.coding.find(coding => coding.display);
    return displayCoding?.display ?? "Unknown condition";
  }

  // Fallback to code
  if (condition.code?.coding?.some(coding => coding.code)) {
    const codeCoding = condition.code.coding.find(coding => coding.code);
    return codeCoding?.code ?? "Unknown condition";
  }

  return "Unknown condition";
};

/**
 * Extracts display text for a condition from Zus data
 */
const getZusConditionDisplay = (condition: Condition): string => {
  // Try to get from note text first
  if (condition.note?.[0]?.text) {
    return condition.note[0].text;
  }

  // Try to get text from code.text
  if (condition.code?.text) {
    return condition.code.text;
  }

  // Try to get from coding display
  if (condition.code?.coding?.some(coding => coding.display)) {
    const displayCoding = condition.code.coding.find(coding => coding.display);
    return displayCoding?.display ?? "Unknown condition";
  }

  // Fallback to code
  if (condition.code?.coding?.some(coding => coding.code)) {
    const codeCoding = condition.code.coding.find(coding => coding.code);
    return codeCoding?.code ?? "Unknown condition";
  }

  return "Unknown condition";
};

/**
 * Extracts the date for a Metriport condition
 */
const getMetriportConditionDate = (condition: Condition): string | undefined => {
  if (condition.onsetPeriod?.start) {
    return condition.onsetPeriod.start;
  }

  if (condition.onsetPeriod?.end) {
    return condition.onsetPeriod.end;
  }

  return condition.recordedDate;
};

/**
 * Extracts the date for a Zus condition
 */
const getZusConditionDate = (condition: Condition): string | undefined => {
  return condition.recordedDate;
};

/**
 * Extracts ICD-10 or SNOMED code from a Metriport condition
 */
const getMetriportConditionCode = (
  condition: Condition
): { system?: string; value: string } | undefined => {
  // Try to find SNOMED or ICD-10 codes first
  const preferredSystems = [
    "http://hl7.org/fhir/sid/icd-10-cm", // ICD-10-CM
    "http://hl7.org/fhir/sid/icd-10", // ICD-10
    "http://snomed.info/sct", // SNOMED
  ];

  if (condition.code?.coding) {
    // First try to find a coding with a preferred system
    for (const system of preferredSystems) {
      const coding = condition.code.coding.find(c => c.system === system && c.code);
      if (coding?.code) {
        return { system: coding.system, value: coding.code };
      }
    }

    // If no preferred system found, take the first available code
    const firstCoding = condition.code.coding.find(c => c.code);
    if (firstCoding?.code) {
      return { system: firstCoding.system, value: firstCoding.code };
    }
  }

  return undefined;
};

/**
 * Extracts ICD-10 or SNOMED code from a Zus condition
 */
const getZusConditionCode = (
  condition: Condition
): { system?: string; value: string } | undefined => {
  // Use the same code extraction logic as Metriport for consistency
  return getMetriportConditionCode(condition);
};

/**
 * Processes conditions from a Metriport bundle
 */
const processMetriportConditions = (bundle: Bundle): ConditionInfo[] => {
  const conditions: ConditionInfo[] = [];

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;

    if (resource?.resourceType !== "Condition" || shouldFilterResource(resource)) {
      return;
    }

    const condition = resource as Condition;
    const code = getMetriportConditionCode(condition);

    conditions.push({
      display: getMetriportConditionDisplay(condition),
      date: getMetriportConditionDate(condition),
      source: "Metriport",
      code,
    });
  });

  return conditions;
};

/**
 * Processes conditions from a Zus bundle
 */
const processZusConditions = (bundle: Bundle): ConditionInfo[] => {
  const conditions: ConditionInfo[] = [];

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;

    if (resource?.resourceType !== "Condition" || shouldFilterResource(resource)) {
      return;
    }

    const condition = resource as Condition;
    const code = getZusConditionCode(condition);

    conditions.push({
      display: getZusConditionDisplay(condition),
      date: getZusConditionDate(condition),
      source: "Zus",
      code,
    });
  });

  return conditions;
};

/**
 * Determines if two conditions are similar based on codes, display text, and date
 */
const areConditionsSimilar = (condition1: ConditionInfo, condition2: ConditionInfo): boolean => {
  // First check if both conditions have codes and if they match
  if (condition1.code?.value && condition2.code?.value) {
    // If codes are identical, consider them similar only if within date threshold
    if (condition1.code.value === condition2.code.value) {
      return areDatesWithinThreshold(condition1.date, condition2.date);
    }

    // If codes have the same system but different values, they are different conditions
    if (
      condition1.code.system &&
      condition2.code.system &&
      condition1.code.system === condition2.code.system
    ) {
      return false;
    }

    // Different systems or no system - fall back to text comparison
  }

  // Create normalized versions of display text for comparison
  const normalizeText = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

  const display1 = normalizeText(condition1.display);
  const display2 = normalizeText(condition2.display);

  // Fast path: If display texts are identical after normalization
  if (display1 === display2) {
    return areDatesWithinThreshold(condition1.date, condition2.date);
  }

  // Fast path: For very different length strings, avoid expensive operations
  const lengthDiff = Math.abs(display1.length - display2.length);
  const shortestLength = Math.min(display1.length, display2.length);
  if (lengthDiff > shortestLength * 0.5) {
    return false;
  }

  // If one is a substring of the other
  if (display1.includes(display2) || display2.includes(display1)) {
    return areDatesWithinThreshold(condition1.date, condition2.date);
  }

  // Only perform expensive word comparison if dates are close enough
  if (areDatesWithinThreshold(condition1.date, condition2.date, 90)) {
    // 90 day threshold for text similarity
    // Check if at least 50% of words match
    const words1 = display1.split(/\s+/);
    const words2 = display2.split(/\s+/);

    // Skip expensive comparison for very different length word arrays
    if (Math.abs(words1.length - words2.length) > Math.min(words1.length, words2.length) * 0.5) {
      return false;
    }

    // Convert shorter array to Set for faster lookups
    const [shortWords, longWords] =
      words1.length <= words2.length ? [new Set(words1), words2] : [new Set(words2), words1];

    const commonWords = longWords.filter(word => shortWords.has(word));
    const similarityRatio = commonWords.length / Math.min(words1.length, words2.length);

    if (similarityRatio >= 0.5) {
      return true;
    }
  }

  return false;
};

/**
 * Determines if two dates are within a specified threshold of days
 * Returns true if:
 * - Both dates are undefined (consider them similar)
 * - One date is undefined but code/text is very similar (legacy data handling)
 * - Both dates exist and are within the threshold
 */
const areDatesWithinThreshold = (
  date1?: string,
  date2?: string,
  thresholdDays = 180 // Default to 6 month threshold
): boolean => {
  // If both dates are missing, consider them similar
  if (!date1 && !date2) {
    return true;
  }

  // If only one date is missing, not similar unless very specific match
  if (!date1 || !date2) {
    return false; // Consider changing this to true for legacy data handling
  }

  // Compare actual dates within threshold
  const dateObj1 = new Date(date1);
  const dateObj2 = new Date(date2);

  // Check for invalid dates
  if (isNaN(dateObj1.getTime()) || isNaN(dateObj2.getTime())) {
    return false;
  }

  const diffTime = Math.abs(dateObj1.getTime() - dateObj2.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays <= thresholdDays;
};

/**
 * Determines if a condition is from the last year
 */
const isConditionFromLastYear = (condition: ConditionInfo): boolean => {
  if (!condition.date) return false;
  const conditionDate = dayjs(condition.date);
  const lastYearDate = dayjs().subtract(1, "year");
  return conditionDate.isAfter(lastYearDate);
};

/**
 * Processes conditions from both Metriport and Zus bundles
 */
export const processConditions = (
  metriportBundle?: Bundle,
  zusBundle?: Bundle
): ConditionSummary => {
  const metriportConditions = metriportBundle ? processMetriportConditions(metriportBundle) : [];
  const zusConditions = zusBundle ? processZusConditions(zusBundle) : [];

  // Early return for empty cases
  if (metriportConditions.length === 0 && zusConditions.length === 0) {
    return {
      metriport: {
        count: 0,
        conditions: [],
        conditionsInLastYear: [],
        uniqueCount: 0,
        uniqueConditions: [],
      },
      zus: {
        count: 0,
        conditions: [],
        conditionsInLastYear: [],
        uniqueCount: 0,
        uniqueConditions: [],
      },
      common: {
        count: 0,
      },
    };
  }

  const uniqueToMetriportConditions = [];
  const metriportConditionsInLastYear = [];

  const uniqueToZusConditions = [];
  const zusConditionsInLastYear = [];

  let commonCount = 0;

  // Process Metriport conditions
  for (const metriportCondition of metriportConditions) {
    // Check if from last year
    if (isConditionFromLastYear(metriportCondition)) {
      metriportConditionsInLastYear.push(metriportCondition);
    }

    // Check if unique or common
    const isUnique = !zusConditions.some(zusCondition =>
      areConditionsSimilar(metriportCondition, zusCondition)
    );

    if (isUnique) {
      uniqueToMetriportConditions.push(metriportCondition);
    } else {
      commonCount++;
    }
  }

  // Process Zus conditions
  for (const zusCondition of zusConditions) {
    // Check if from last year
    if (isConditionFromLastYear(zusCondition)) {
      zusConditionsInLastYear.push(zusCondition);
    }

    // Check if unique (we already counted common conditions above)
    const isUnique = !metriportConditions.some(metriportCondition =>
      areConditionsSimilar(metriportCondition, zusCondition)
    );

    if (isUnique) {
      uniqueToZusConditions.push(zusCondition);
    }
  }

  return {
    metriport: {
      count: metriportConditions.length,
      conditions: metriportConditions,
      conditionsInLastYear: metriportConditionsInLastYear,
      uniqueCount: uniqueToMetriportConditions.length,
      uniqueConditions: uniqueToMetriportConditions,
    },
    zus: {
      count: zusConditions.length,
      conditions: zusConditions,
      conditionsInLastYear: zusConditionsInLastYear,
      uniqueCount: uniqueToZusConditions.length,
      uniqueConditions: uniqueToZusConditions,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Formats the condition summary with year-based analysis
 */
export const formatConditionSummary = (summary: ConditionSummary): string => {
  let result = "";

  // Calculate totals
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  const lastYearMetriportCount = summary.metriport.conditionsInLastYear.length;
  const lastYearZusCount = summary.zus.conditionsInLastYear.length;

  // Determine which source had more conditions in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Determine which source had more conditions in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the results as questions and answers
  result += "### Comparing Conditions between Metriport and Zus\n\n";

  result += `**Which source had more conditions in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of conditions (${lastYearMetriportCount}) in the last year.\n\n`;
  } else {
    result += `${moreLastYear} had more conditions in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;

    // Add explanation of the last year difference if needed
    if (lastYearMetriportCount > 0 || lastYearZusCount > 0) {
      result += `**Conditions from the last year by source:**\n\n`;

      if (lastYearMetriportCount > 0) {
        result += `**Metriport conditions from the last year (${lastYearMetriportCount}):**\n\n`;
        const lastYearMetriportByYear = groupConditionsByYear(
          summary.metriport.conditionsInLastYear
        );
        result += formatConditionsByYear(lastYearMetriportByYear);
      }

      if (lastYearZusCount > 0) {
        result += `**Zus conditions from the last year (${lastYearZusCount}):**\n\n`;
        const lastYearZusByYear = groupConditionsByYear(summary.zus.conditionsInLastYear);
        result += formatConditionsByYear(lastYearZusByYear);
      }
    }
  }

  result += `**Which source had more conditions in total?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of conditions (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more total conditions (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique conditions from both sources
  result += `**Conditions unique to each source:**\n\n`;

  // Show unique Metriport conditions
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} conditions that were not found in Zus:**\n\n`;
    const uniqueMetriportConditionsByYear = groupConditionsByYear(
      summary.metriport.uniqueConditions
    );
    result += formatConditionsByYear(uniqueMetriportConditionsByYear);
  } else {
    result += `**Metriport had no unique conditions (all matched in Zus)**\n\n`;
  }

  // Show unique Zus conditions
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} conditions that were not found in Metriport:**\n\n`;
    const uniqueZusConditionsByYear = groupConditionsByYear(summary.zus.uniqueConditions);
    result += formatConditionsByYear(uniqueZusConditionsByYear);
  } else {
    result += `**Zus had no unique conditions (all matched in Metriport)**\n\n`;
  }

  result += `**Common conditions found in both sources: ${summary.common.count}**\n\n`;

  return result;
};

/**
 * Groups conditions by year and sorts them in descending order by date
 */
const groupConditionsByYear = (conditions: ConditionInfo[]): Record<string, ConditionInfo[]> => {
  // Pre-allocate for better performance
  const conditionsByYear: Record<string, ConditionInfo[]> = {};

  // Group by year in a single pass
  for (const condition of conditions) {
    let year = "Unknown";

    if (condition.date) {
      // Extract year using substring instead of regex for better performance
      year = condition.date.substring(0, 4);
    }

    if (!conditionsByYear[year]) {
      conditionsByYear[year] = [];
    }

    conditionsByYear[year].push(condition);
  }

  // Sort each year's conditions in a single pass
  for (const year in conditionsByYear) {
    conditionsByYear[year].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }

  return conditionsByYear;
};

/**
 * Formats conditions grouped by year
 */
const formatConditionsByYear = (conditionsByYear: Record<string, ConditionInfo[]>): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(conditionsByYear).sort((a, b) => {
    // "Unknown" year should be last
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    // Otherwise, sort years in descending order
    return b.localeCompare(a);
  });

  years.forEach(year => {
    const yearConditions = conditionsByYear[year];
    result += `### ${year} (${yearConditions.length})\n\n`;

    yearConditions.forEach(condition => {
      const codeDisplay = condition.code
        ? ` [${condition.code.system ? condition.code.system.split("/").pop() + ": " : ""}${
            condition.code.value
          }]`
        : "";
      const dateDisplay = condition.date ? ` (${condition.date})` : "";

      // Display code immediately after the condition name, before the date
      result += `- ${condition.display}${codeDisplay}${dateDisplay}\n`;
    });

    result += "\n";
  });

  return result;
};
