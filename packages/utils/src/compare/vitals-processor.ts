import { Bundle, Observation } from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";
import dayjs from "dayjs";

/**
 * Represents a vital sign with necessary information for comparison
 */
export interface VitalSignItem {
  id: string;
  name: string;
  code: string;
  system: string;
  date?: string;
  value?: string;
  unit?: string;
}

/**
 * Structure for summary of a specific source's vital signs data
 */
export interface VitalSignSourceSummary {
  count: number;
  vitalSigns: VitalSignItem[];
  vitalSignsInLastYear: VitalSignItem[];
  uniqueCount: number;
  uniqueVitalSigns: VitalSignItem[];
}

/**
 * Structure for the combined summary of vital signs data from both sources
 */
export interface VitalSignSummary {
  metriport: VitalSignSourceSummary;
  zus: VitalSignSourceSummary;
  common: {
    count: number;
  };
}

/**
 * Common LOINC codes for vital signs
 */
const VITAL_SIGN_LOINC_CODES = [
  "8867-4", // Heart rate
  "8480-6", // Systolic blood pressure
  "8462-4", // Diastolic blood pressure
  "8310-5", // Body temperature
  "9279-1", // Respiratory rate
  "8287-5", // Head circumference
  "8302-2", // Body height
  "8306-3", // Body height lying
  "8308-9", // Body height standing
  "29463-7", // Body weight
  "39156-5", // BMI
  "8280-0", // Waist circumference
  "9843-4", // Head circumference percentile
  "59574-4", // Blood pressure panel
  "2093-3", // Total cholesterol
  "2571-8", // Triglycerides
  "2085-9", // HDL cholesterol
  "1975-2", // LDL cholesterol
  "2339-0", // Glucose
  "4548-4", // Hemoglobin A1c
  "2160-0", // Creatinine
  "20570-8", // Hematocrit
  "718-7", // Hemoglobin
  "6690-2", // White blood cell count
  "751-8", // Neutrophils
  "731-0", // Lymphocytes
  "2157-6", // Creatine kinase
  "1920-8", // SGOT/AST
  "1742-6", // Alanine aminotransferase
];

/**
 * Extracts vital signs from a FHIR bundle
 */
export const extractVitalSigns = (bundle: Bundle): VitalSignItem[] => {
  if (!bundle.entry) return [];

  return bundle.entry
    .filter(entry => {
      const resource = entry.resource;
      if (!resource || resource.resourceType !== "Observation" || shouldFilterResource(resource))
        return false;

      // Check if this is a vital sign observation
      const observation = resource as Observation;

      // Check by vital sign category
      const isVitalSignCategory = observation.category?.some(category =>
        category.coding?.some(
          coding =>
            coding.code === "vital-signs" ||
            coding.display?.toLowerCase().includes("vital") ||
            coding.code === "laboratory" // Some systems store vitals as labs
        )
      );

      // If categorized as vital sign, return true
      if (isVitalSignCategory) return true;

      // Otherwise check by LOINC code
      return (
        observation.code?.coding?.some(
          coding =>
            coding.system?.includes("loinc") && VITAL_SIGN_LOINC_CODES.includes(coding.code || "")
        ) ?? false
      );
    })
    .map(entry => {
      const observation = entry.resource as Observation;
      const coding = observation.code?.coding?.[0];

      // Get the display name and value
      const baseName = observation.code?.text || coding?.display || "Unknown";

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
      } else if (observation.valueInteger) {
        value = observation.valueInteger.toString();
      } else if (observation.valueBoolean !== undefined) {
        value = observation.valueBoolean.toString();
      }

      return {
        id: observation.id || entry.fullUrl || "unknown",
        name: baseName,
        code: coding?.code || "unknown",
        system: coding?.system || "unknown",
        date: observation.effectiveDateTime || observation.effectivePeriod?.start,
        value,
        unit,
      };
    });
};

/**
 * Compares vital sign items for equivalence
 */
const areVitalSignsEquivalent = (item1: VitalSignItem, item2: VitalSignItem): boolean => {
  // Primary matching criteria: same code and system
  const sameCode = item1.code === item2.code && item1.system === item2.system;

  if (sameCode) {
    // If code matches and date is within one day, consider them equivalent
    if (item1.date && item2.date) {
      const date1 = new Date(item1.date);
      const date2 = new Date(item2.date);
      const diffTime = Math.abs(date1.getTime() - date2.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      return diffDays <= 1;
    }

    return true; // Same code, but one or both don't have dates
  }

  return false;
};

/**
 * Determines if a vital sign is from the last year
 */
const isVitalSignFromLastYear = (vitalSign: VitalSignItem): boolean => {
  if (!vitalSign.date) return false;
  const vitalSignDate = dayjs(vitalSign.date);
  const lastYearDate = dayjs().subtract(1, "year");
  return vitalSignDate.isAfter(lastYearDate);
};

/**
 * Processes vital sign data from two sources and generates a comparison summary
 */
export const processVitalSigns = (metriportBundle: Bundle, zusBundle: Bundle): VitalSignSummary => {
  const metriportVitalSigns = extractVitalSigns(metriportBundle);
  const zusVitalSigns = extractVitalSigns(zusBundle);

  const uniqueToMetriportVitalSigns = [];
  const metriportVitalSignsInLastYear = [];

  const uniqueToZusVitalSigns = [];
  const zusVitalSignsInLastYear = [];

  let commonCount = 0;

  // Process Metriport vital signs
  for (const metriportVitalSign of metriportVitalSigns) {
    // Check if from last year
    if (isVitalSignFromLastYear(metriportVitalSign)) {
      metriportVitalSignsInLastYear.push(metriportVitalSign);
    }

    // Check if unique or common
    const isUnique = !zusVitalSigns.some(zusVitalSign =>
      areVitalSignsEquivalent(metriportVitalSign, zusVitalSign)
    );

    if (isUnique) {
      uniqueToMetriportVitalSigns.push(metriportVitalSign);
    } else {
      commonCount++;
    }
  }

  // Process Zus vital signs
  for (const zusVitalSign of zusVitalSigns) {
    // Check if from last year
    if (isVitalSignFromLastYear(zusVitalSign)) {
      zusVitalSignsInLastYear.push(zusVitalSign);
    }

    // Check if unique
    const isUnique = !metriportVitalSigns.some(metriportVitalSign =>
      areVitalSignsEquivalent(metriportVitalSign, zusVitalSign)
    );

    if (isUnique) {
      uniqueToZusVitalSigns.push(zusVitalSign);
    }
  }

  return {
    metriport: {
      count: metriportVitalSigns.length,
      vitalSigns: metriportVitalSigns,
      vitalSignsInLastYear: metriportVitalSignsInLastYear,
      uniqueCount: uniqueToMetriportVitalSigns.length,
      uniqueVitalSigns: uniqueToMetriportVitalSigns,
    },
    zus: {
      count: zusVitalSigns.length,
      vitalSigns: zusVitalSigns,
      vitalSignsInLastYear: zusVitalSignsInLastYear,
      uniqueCount: uniqueToZusVitalSigns.length,
      uniqueVitalSigns: uniqueToZusVitalSigns,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Groups vital signs by year
 */
export const groupVitalSignsByYear = (
  vitalSigns: VitalSignItem[]
): Record<string, VitalSignItem[]> => {
  const result: Record<string, VitalSignItem[]> = {};

  vitalSigns.forEach(item => {
    const year = item.date ? new Date(item.date).getFullYear().toString() : "Unknown";
    if (!result[year]) {
      result[year] = [];
    }
    result[year].push(item);
  });

  return result;
};

/**
 * Formats vital sign items grouped by year
 */
const formatVitalSignsByYear = (vitalSignsByYear: Record<string, VitalSignItem[]>): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(vitalSignsByYear).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return parseInt(b) - parseInt(a);
  });

  years.forEach(year => {
    result += `**${year}**\n\n`;

    vitalSignsByYear[year].forEach(item => {
      result += `- ${item.name}`;
      if (item.value) {
        result += `: ${item.value}`;
        if (item.unit) {
          result += ` ${item.unit}`;
        }
      }
      result += "\n";
    });

    result += "\n";
  });

  return result;
};

/**
 * Formats the vital sign summary in a question-answer format
 */
export const formatVitalSignSummary = (summary: VitalSignSummary): string => {
  let result = "";
  const currentDate = new Date();
  const lastYearDate = new Date();
  lastYearDate.setFullYear(currentDate.getFullYear() - 1);

  // Filter vital signs from the last year
  const lastYearMetriportVitalSigns = summary.metriport.vitalSigns.filter(vitalSign => {
    if (!vitalSign.date) return false;
    const vitalSignDate = new Date(vitalSign.date);
    return vitalSignDate >= lastYearDate;
  });

  const lastYearZusVitalSigns = summary.zus.vitalSigns.filter(vitalSign => {
    if (!vitalSign.date) return false;
    const vitalSignDate = new Date(vitalSign.date);
    return vitalSignDate >= lastYearDate;
  });

  // Calculate totals and differences
  const lastYearMetriportCount = lastYearMetriportVitalSigns.length;
  const lastYearZusCount = lastYearZusVitalSigns.length;
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  // Determine which source had more vital signs in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Determine which source had more vital signs in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the summary
  result += "### Comparing Vital Signs between Metriport and Zus\n\n";

  result += `**Which source had more vital signs in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of vital signs (${lastYearMetriportCount}) in the last year.\n\n`;
  } else {
    result += `${moreLastYear} had more vital signs in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;
  }

  result += `**Which source had more vital signs in total?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of vital signs (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more total vital signs (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique vital signs from both sources
  result += `**Vital signs unique to each source:**\n\n`;

  // Show unique Metriport vital signs
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} vital signs that were not found in Zus:**\n\n`;
    const uniqueMetriportVitalSignsByYear = groupVitalSignsByYear(
      summary.metriport.uniqueVitalSigns
    );
    result += formatVitalSignsByYear(uniqueMetriportVitalSignsByYear);
  } else {
    result += `**Metriport had no unique vital signs (all matched in Zus)**\n\n`;
  }

  // Show unique Zus vital signs
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} vital signs that were not found in Metriport:**\n\n`;
    const uniqueZusVitalSignsByYear = groupVitalSignsByYear(summary.zus.uniqueVitalSigns);
    result += formatVitalSignsByYear(uniqueZusVitalSignsByYear);
  } else {
    result += `**Zus had no unique vital signs (all matched in Metriport)**\n\n`;
  }

  result += `**Common vital signs found in both sources: ${summary.common.count}**\n\n`;

  return result;
};
