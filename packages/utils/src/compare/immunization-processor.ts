import { Bundle, Immunization } from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";
import dayjs from "dayjs";

/**
 * Represents an immunization with its display information
 */
interface ImmunizationInfo {
  display: string;
  date?: string;
  source: "Metriport" | "Zus";
}

/**
 * Represents the summary of immunizations by source
 */
interface ImmunizationSummary {
  metriport: {
    count: number;
    immunizations: ImmunizationInfo[];
    immunizationsInLastYear: ImmunizationInfo[];
    uniqueCount: number;
    uniqueImmunizations: ImmunizationInfo[];
  };
  zus: {
    count: number;
    immunizations: ImmunizationInfo[];
    immunizationsInLastYear: ImmunizationInfo[];
    uniqueCount: number;
    uniqueImmunizations: ImmunizationInfo[];
  };
  common: {
    count: number;
  };
}

/**
 * Extracts display text for an immunization from Metriport data
 */
const getMetriportImmunizationDisplay = (immunization: Immunization): string => {
  // Try to get from code.text first
  if (immunization.vaccineCode?.text) {
    return immunization.vaccineCode.text;
  }

  // Try to get from coding display
  if (immunization.vaccineCode?.coding?.some(coding => coding.display)) {
    const displayCoding = immunization.vaccineCode.coding.find(coding => coding.display);
    return displayCoding?.display ?? "Unknown immunization";
  }

  // Fallback to code
  if (immunization.vaccineCode?.coding?.some(coding => coding.code)) {
    const codeCoding = immunization.vaccineCode.coding.find(coding => coding.code);
    return codeCoding?.code ?? "Unknown immunization";
  }

  return "Unknown immunization";
};

/**
 * Extracts display text for an immunization from Zus data
 */
const getZusImmunizationDisplay = (immunization: Immunization): string => {
  // Try to get from code.text first
  if (immunization.vaccineCode?.text) {
    return immunization.vaccineCode.text;
  }

  // Try to get from coding display
  if (immunization.vaccineCode?.coding?.some(coding => coding.display)) {
    const displayCoding = immunization.vaccineCode.coding.find(coding => coding.display);
    return displayCoding?.display ?? "Unknown immunization";
  }

  // Try to get from note text
  if (immunization.note?.[0]?.text) {
    // Extract the first line or first part until a newline or period
    const noteText = immunization.note[0].text;
    const firstLine = noteText.split(/[\n\r.]/)[0].trim();
    return firstLine || "Unknown immunization";
  }

  // Fallback to code
  if (immunization.vaccineCode?.coding?.some(coding => coding.code)) {
    const codeCoding = immunization.vaccineCode.coding.find(coding => coding.code);
    return codeCoding?.code ?? "Unknown immunization";
  }

  return "Unknown immunization";
};

/**
 * Gets the date from an immunization
 */
const getImmunizationDate = (immunization: Immunization): string | undefined => {
  return immunization.occurrenceDateTime;
};

/**
 * Processes immunizations from a Metriport bundle
 */
const processMetriportImmunizations = (bundle: Bundle): ImmunizationInfo[] => {
  const immunizations: ImmunizationInfo[] = [];

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;

    if (resource?.resourceType !== "Immunization" || shouldFilterResource(resource)) {
      return;
    }

    const immunization = resource as Immunization;

    immunizations.push({
      display: getMetriportImmunizationDisplay(immunization),
      date: getImmunizationDate(immunization),
      source: "Metriport",
    });
  });

  return immunizations;
};

/**
 * Processes immunizations from a Zus bundle
 */
const processZusImmunizations = (bundle: Bundle): ImmunizationInfo[] => {
  const immunizations: ImmunizationInfo[] = [];

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;

    if (resource?.resourceType !== "Immunization" || shouldFilterResource(resource)) {
      return;
    }

    const immunization = resource as Immunization;

    immunizations.push({
      display: getZusImmunizationDisplay(immunization),
      date: getImmunizationDate(immunization),
      source: "Zus",
    });
  });

  return immunizations;
};

/**
 * Determines if two immunizations are similar based on display text and date
 */
const areImmunizationsSimilar = (
  immunization1: ImmunizationInfo,
  immunization2: ImmunizationInfo
): boolean => {
  // Create normalized versions of display text for comparison
  const normalizeText = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

  const display1 = normalizeText(immunization1.display);
  const display2 = normalizeText(immunization2.display);

  // If display texts are very similar, consider them a match
  if (display1 === display2) {
    return true;
  }

  // If one is a substring of the other (with some flexibility)
  if (display1.includes(display2) || display2.includes(display1)) {
    return true;
  }

  // If dates match exactly and display texts are somewhat similar
  if (immunization1.date && immunization2.date && immunization1.date === immunization2.date) {
    // Check if at least 50% of words match
    const words1 = display1.split(/\s+/);
    const words2 = display2.split(/\s+/);

    const commonWords = words1.filter(word => words2.includes(word));
    const similarityRatio = commonWords.length / Math.min(words1.length, words2.length);

    if (similarityRatio >= 0.5) {
      return true;
    }
  }

  return false;
};

/**
 * Determines if an immunization is from the last year
 */
const isImmunizationFromLastYear = (immunization: ImmunizationInfo): boolean => {
  if (!immunization.date) return false;
  const immunizationDate = dayjs(immunization.date);
  const lastYearDate = dayjs().subtract(1, "year");
  return immunizationDate.isAfter(lastYearDate);
};

/**
 * Processes immunizations from both Metriport and Zus bundles
 */
export const processImmunizations = (
  metriportBundle?: Bundle,
  zusBundle?: Bundle
): ImmunizationSummary => {
  const metriportImmunizations = metriportBundle
    ? processMetriportImmunizations(metriportBundle)
    : [];
  const zusImmunizations = zusBundle ? processZusImmunizations(zusBundle) : [];

  const uniqueToMetriportImmunizations = [];
  const metriportImmunizationsInLastYear = [];

  const uniqueToZusImmunizations = [];
  const zusImmunizationsInLastYear = [];

  let commonCount = 0;

  // Process Metriport immunizations
  for (const metriportImmunization of metriportImmunizations) {
    // Check if from last year
    if (isImmunizationFromLastYear(metriportImmunization)) {
      metriportImmunizationsInLastYear.push(metriportImmunization);
    }

    // Check if unique or common
    const isUnique = !zusImmunizations.some(zusImmunization =>
      areImmunizationsSimilar(metriportImmunization, zusImmunization)
    );

    if (isUnique) {
      uniqueToMetriportImmunizations.push(metriportImmunization);
    } else {
      commonCount++;
    }
  }

  // Process Zus immunizations
  for (const zusImmunization of zusImmunizations) {
    // Check if from last year
    if (isImmunizationFromLastYear(zusImmunization)) {
      zusImmunizationsInLastYear.push(zusImmunization);
    }

    // Check if unique
    const isUnique = !metriportImmunizations.some(metriportImmunization =>
      areImmunizationsSimilar(metriportImmunization, zusImmunization)
    );

    if (isUnique) {
      uniqueToZusImmunizations.push(zusImmunization);
    }
  }

  return {
    metriport: {
      count: metriportImmunizations.length,
      immunizations: metriportImmunizations,
      immunizationsInLastYear: metriportImmunizationsInLastYear,
      uniqueCount: uniqueToMetriportImmunizations.length,
      uniqueImmunizations: uniqueToMetriportImmunizations,
    },
    zus: {
      count: zusImmunizations.length,
      immunizations: zusImmunizations,
      immunizationsInLastYear: zusImmunizationsInLastYear,
      uniqueCount: uniqueToZusImmunizations.length,
      uniqueImmunizations: uniqueToZusImmunizations,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Formats the immunization summary in a question-answer format
 */
export const formatImmunizationSummary = (summary: ImmunizationSummary): string => {
  let result = "";
  const currentDate = new Date();
  const lastYearDate = new Date();
  lastYearDate.setFullYear(currentDate.getFullYear() - 1);

  // Filter immunizations from the last year
  const lastYearMetriportImmunizations = summary.metriport.immunizations.filter(immunization => {
    if (!immunization.date) return false;
    const immunizationDate = new Date(immunization.date);
    return immunizationDate >= lastYearDate;
  });

  const lastYearZusImmunizations = summary.zus.immunizations.filter(immunization => {
    if (!immunization.date) return false;
    const immunizationDate = new Date(immunization.date);
    return immunizationDate >= lastYearDate;
  });

  // Calculate totals and differences
  const lastYearMetriportCount = lastYearMetriportImmunizations.length;
  const lastYearZusCount = lastYearZusImmunizations.length;
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  // Determine which source had more immunizations in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Determine which source had more immunizations in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the results as questions and answers
  result += "### Comparing Immunizations between Metriport and Zus\n\n";

  result += `**Which source had more immunizations in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of immunizations (${lastYearMetriportCount}) in the last year.\n\n`;
  } else {
    result += `${moreLastYear} had more immunizations in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;
  }

  result += `**Which source had more immunizations in total?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of immunizations (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more total immunizations (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique immunizations from both sources
  result += `**Immunizations unique to each source:**\n\n`;

  // Show unique Metriport immunizations
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} immunizations that were not found in Zus:**\n\n`;
    const uniqueMetriportImmunizationsByYear = groupImmunizationsByYear(
      summary.metriport.uniqueImmunizations
    );
    result += formatImmunizationsByYear(uniqueMetriportImmunizationsByYear);
  } else {
    result += `**Metriport had no unique immunizations (all matched in Zus)**\n\n`;
  }

  // Show unique Zus immunizations
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} immunizations that were not found in Metriport:**\n\n`;
    const uniqueZusImmunizationsByYear = groupImmunizationsByYear(summary.zus.uniqueImmunizations);
    result += formatImmunizationsByYear(uniqueZusImmunizationsByYear);
  } else {
    result += `**Zus had no unique immunizations (all matched in Metriport)**\n\n`;
  }

  result += `**Common immunizations found in both sources: ${summary.common.count}**\n\n`;

  return result;
};

/**
 * Groups immunizations by year and sorts them in descending order by date
 */
const groupImmunizationsByYear = (
  immunizations: ImmunizationInfo[]
): Record<string, ImmunizationInfo[]> => {
  // Sort immunizations by date (most recent first)
  const sortedImmunizations = [...immunizations].sort((a, b) => {
    // If no dates are available, keep original order
    if (!a.date && !b.date) return 0;
    // Items with no date go last
    if (!a.date) return 1;
    if (!b.date) return -1;
    // Sort descending by date
    return b.date.localeCompare(a.date);
  });

  // Group by year
  const immunizationsByYear: Record<string, ImmunizationInfo[]> = {};

  sortedImmunizations.forEach(immunization => {
    let year = "Unknown";

    if (immunization.date) {
      // Extract year from ISO date string (YYYY-MM-DD or YYYY)
      const match = immunization.date.match(/^(\d{4})/);
      if (match) {
        year = match[1];
      }
    }

    if (!immunizationsByYear[year]) {
      immunizationsByYear[year] = [];
    }

    immunizationsByYear[year].push(immunization);
  });

  return immunizationsByYear;
};

/**
 * Formats immunizations by year for display
 */
const formatImmunizationsByYear = (
  immunizationsByYear: Record<string, ImmunizationInfo[]>
): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(immunizationsByYear).sort((a, b) => {
    // "Unknown" year should be last
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    // Otherwise, sort years in descending order
    return b.localeCompare(a);
  });

  years.forEach(year => {
    const yearImmunizations = immunizationsByYear[year];
    result += `### ${year} (${yearImmunizations.length})\n\n`;

    yearImmunizations.forEach(immunization => {
      const dateDisplay = immunization.date ? ` (${immunization.date})` : "";
      result += `- ${immunization.display}${dateDisplay}\n`;
    });

    result += "\n";
  });

  return result;
};
