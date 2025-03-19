import { Bundle, Observation } from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";
import dayjs from "dayjs";

/**
 * Represents a laboratory result with necessary information for comparison
 */
export interface LabItem {
  id: string;
  name: string;
  code: string;
  system: string;
  date?: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
}

/**
 * Structure for summary of a specific source's lab data
 */
export interface LabSourceSummary {
  count: number;
  labs: LabItem[];
  labsInLastYear: LabItem[];
  uniqueCount: number;
  uniqueLabs: LabItem[];
}

/**
 * Structure for the combined summary of lab data from both sources
 */
export interface LabSummary {
  metriport: LabSourceSummary;
  zus: LabSourceSummary;
  common: {
    count: number;
  };
}

/**
 * Extracts laboratory results from a FHIR bundle
 */
export const extractLabs = (bundle: Bundle, isMetriport: boolean): LabItem[] => {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter(entry => {
      const resource = entry.resource;
      if (!resource || resource.resourceType !== "Observation" || shouldFilterResource(resource))
        return false;

      // Check if this is a laboratory observation
      const observation = resource as Observation;

      if (isMetriport) {
        // Metriport: check by laboratory category
        return (
          observation.category?.some(category =>
            category.coding?.some(
              coding =>
                coding.code === "laboratory" ||
                (coding.display?.toLowerCase().includes("lab") &&
                  !coding.display?.toLowerCase().includes("vital"))
            )
          ) ?? false
        );
      } else {
        // Zus: check by coding with display "laboratory"
        return (
          observation.code?.coding?.some(
            coding =>
              coding.display?.toLowerCase().includes("laboratory") ||
              coding.code?.toLowerCase().includes("lab")
          ) ??
          (false ||
            // Or check by category as fallback
            observation.category?.some(category =>
              category.coding?.some(
                coding =>
                  coding.code === "laboratory" || coding.display?.toLowerCase().includes("lab")
              )
            )) ??
          false
        );
      }
    })
    .map(entry => {
      const observation = entry.resource as Observation;
      const coding = observation.code?.coding?.[0];

      // Get the display name
      let name = "";
      if (isMetriport) {
        name = observation.code?.text || coding?.display || "Unknown";
      } else {
        name = observation.code?.text || "Unknown";
      }

      // Get the value (could be in different formats)
      const valueQuantity = observation.valueQuantity;
      let value: string | undefined;
      let unit: string | undefined;

      if (valueQuantity) {
        value = valueQuantity.value?.toString();
        unit = valueQuantity.unit;
      } else if (observation.valueCodeableConcept) {
        value =
          observation.valueCodeableConcept.text ||
          observation.valueCodeableConcept.coding?.[0]?.display;
      } else if (observation.valueString) {
        value = observation.valueString;
      } else if (observation.valueBoolean !== undefined) {
        value = observation.valueBoolean ? "Positive" : "Negative";
      }

      // Get reference range if available
      let referenceRange: string | undefined;
      if (observation.referenceRange && observation.referenceRange.length > 0) {
        const range = observation.referenceRange[0];
        if (range.low && range.high) {
          referenceRange = `${range.low.value} - ${range.high.value} ${range.low.unit || ""}`;
        } else if (range.low) {
          referenceRange = `> ${range.low.value} ${range.low.unit || ""}`;
        } else if (range.high) {
          referenceRange = `< ${range.high.value} ${range.high.unit || ""}`;
        } else if (range.text) {
          referenceRange = range.text;
        }
      }

      // Get the date
      let date: string | undefined;
      if (observation.effectiveDateTime) {
        date = observation.effectiveDateTime;
      } else if (observation.effectivePeriod?.start) {
        date = observation.effectivePeriod.start;
      }

      return {
        id: observation.id || entry.fullUrl || "unknown",
        name,
        code: coding?.code || "unknown",
        system: coding?.system || "unknown",
        date,
        value,
        unit,
        referenceRange,
      };
    });
};

/**
 * Compares lab items for equivalence
 * Two labs are considered equivalent if they have the same code, system and date (within 1 day)
 */
const areLabsEquivalent = (lab1: LabItem, lab2: LabItem): boolean => {
  // If either lab has no date, just check code and system
  if (!lab1.date || !lab2.date) {
    return lab1.code === lab2.code && lab1.system === lab2.system;
  }

  // Check if code and system match
  const codeMatch = lab1.code === lab2.code && lab1.system === lab2.system;
  if (!codeMatch) return false;

  // Check if dates are within 1 day of each other
  const date1 = new Date(lab1.date);
  const date2 = new Date(lab2.date);
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  return diffDays <= 1;
};

/**
 * Determines if a lab item is from the last year
 */
const isLabFromLastYear = (lab: LabItem): boolean => {
  if (!lab.date) return false;
  const labDate = dayjs(lab.date);
  const lastYearDate = dayjs().subtract(1, "year");
  return labDate.isAfter(lastYearDate);
};

/**
 * Processes laboratory data from two sources and generates a comparison summary
 */
export const processLabs = (metriportBundle: Bundle, zusBundle: Bundle): LabSummary => {
  // Extract lab observations from both sources
  const metriportLabs = extractLabs(metriportBundle, true);
  const zusLabs = extractLabs(zusBundle, false);

  const uniqueToMetriportLabs = [];
  const metriportLabsInLastYear = [];

  const uniqueToZusLabs = [];
  const zusLabsInLastYear = [];

  let commonCount = 0;

  // Process Metriport labs
  for (const metriportLab of metriportLabs) {
    // Check if from last year
    if (isLabFromLastYear(metriportLab)) {
      metriportLabsInLastYear.push(metriportLab);
    }

    // Check if unique or common
    const isUnique = !zusLabs.some(zusLab => areLabsEquivalent(metriportLab, zusLab));

    if (isUnique) {
      uniqueToMetriportLabs.push(metriportLab);
    } else {
      commonCount++;
    }
  }

  // Process Zus labs
  for (const zusLab of zusLabs) {
    // Check if from last year
    if (isLabFromLastYear(zusLab)) {
      zusLabsInLastYear.push(zusLab);
    }

    // Check if unique
    const isUnique = !metriportLabs.some(metriportLab => areLabsEquivalent(metriportLab, zusLab));

    if (isUnique) {
      uniqueToZusLabs.push(zusLab);
    }
  }

  return {
    metriport: {
      count: metriportLabs.length,
      labs: metriportLabs,
      labsInLastYear: metriportLabsInLastYear,
      uniqueCount: uniqueToMetriportLabs.length,
      uniqueLabs: uniqueToMetriportLabs,
    },
    zus: {
      count: zusLabs.length,
      labs: zusLabs,
      labsInLastYear: zusLabsInLastYear,
      uniqueCount: uniqueToZusLabs.length,
      uniqueLabs: uniqueToZusLabs,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Groups lab items by year
 */
export const groupLabsByYear = (labs: LabItem[]): Record<string, LabItem[]> => {
  const result: Record<string, LabItem[]> = {};

  labs.forEach(item => {
    let year = "Unknown";

    if (item.date) {
      const date = new Date(item.date);
      year = date.getFullYear().toString();
    }

    if (!result[year]) {
      result[year] = [];
    }
    result[year].push(item);
  });

  return result;
};

/**
 * Formats lab items grouped by year
 */
const formatLabsByYear = (labsByYear: Record<string, LabItem[]>): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(labsByYear).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return parseInt(b) - parseInt(a);
  });

  years.forEach(year => {
    result += `**${year}**\n\n`;

    labsByYear[year].forEach(item => {
      result += `- ${item.name}`;
      if (item.value) {
        result += `: ${item.value}`;
        if (item.unit) {
          result += ` ${item.unit}`;
        }
      }
      if (item.referenceRange) {
        result += ` (Reference Range: ${item.referenceRange})`;
      }
      result += "\n";
    });

    result += "\n";
  });

  return result;
};

/**
 * Formats the laboratory summary in a question-answer format
 */
export const formatLabSummary = (summary: LabSummary): string => {
  let result = "";

  // Calculate totals
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  const lastYearMetriportCount = summary.metriport.labsInLastYear.length;
  const lastYearZusCount = summary.zus.labsInLastYear.length;

  // Determine which source had more labs in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Format the summary
  result += "### Comparing Laboratory Results between Metriport and Zus\n\n";

  result += `**Which source had more laboratory results in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of laboratory results (${lastYearMetriportCount}) in the last year.\n\n`;
  } else {
    result += `${moreLastYear} had more laboratory results in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;
  }

  result += `**Which source had more laboratory results in total?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of laboratory results (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreLastYear} had more total laboratory results (${
      moreLastYear === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreLastYear === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique labs from both sources
  result += `**Laboratory results unique to each source:**\n\n`;

  // Show unique Metriport labs
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} laboratory results that were not found in Zus:**\n\n`;
    const uniqueMetriportLabsByYear = groupLabsByYear(summary.metriport.uniqueLabs);
    result += formatLabsByYear(uniqueMetriportLabsByYear);
  } else {
    result += `**Metriport had no unique laboratory results (all matched in Zus)**\n\n`;
  }

  // Show unique Zus labs
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} laboratory results that were not found in Metriport:**\n\n`;
    const uniqueZusLabsByYear = groupLabsByYear(summary.zus.uniqueLabs);
    result += formatLabsByYear(uniqueZusLabsByYear);
  } else {
    result += `**Zus had no unique laboratory results (all matched in Metriport)**\n\n`;
  }

  result += `**Common laboratory results found in both sources: ${summary.common.count}**\n\n`;

  return result;
};
