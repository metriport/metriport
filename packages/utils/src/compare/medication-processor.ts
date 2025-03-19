import {
  Bundle,
  MedicationStatement,
  Medication,
  MedicationDispense,
  MedicationAdministration,
} from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";
import dayjs from "dayjs";

/**
 * Represents a medication with its display information
 */
interface MedicationInfo {
  display: string;
  date?: string;
  code?: string;
  source: "Metriport" | "Zus";
}

/**
 * Represents the summary of medications by source
 */
interface MedicationSummary {
  metriport: {
    count: number;
    medications: MedicationInfo[];
    medicationsInLastYear: MedicationInfo[];
    uniqueCount: number;
    uniqueMedications: MedicationInfo[];
  };
  zus: {
    count: number;
    medications: MedicationInfo[];
    medicationsInLastYear: MedicationInfo[];
    uniqueCount: number;
    uniqueMedications: MedicationInfo[];
  };
  common: {
    count: number;
  };
}

/**
 * Gets the medication resource from a reference in the bundle
 */
const getMedicationFromReference = (bundle: Bundle, reference: string): Medication | undefined => {
  const resourceId = reference.split("/").pop();

  return bundle.entry?.find(
    entry => entry.resource?.resourceType === "Medication" && entry.resource.id === resourceId
  )?.resource as Medication;
};

/**
 * Extracts display text and code for a medication from Metriport data
 */
const getMetriportMedicationInfo = (
  statement: MedicationStatement,
  bundle: Bundle
): { display: string; code?: string } => {
  let display = "Unknown medication";
  let code;

  // First try to get info from medicationCodeableConcept
  if (statement.medicationCodeableConcept) {
    // Use text if available
    if (statement.medicationCodeableConcept.text) {
      display = statement.medicationCodeableConcept.text;
    }
    // Otherwise use display from coding
    else if (statement.medicationCodeableConcept.coding?.[0]?.display) {
      display = statement.medicationCodeableConcept.coding[0].display;
    }

    // Get code (rxNorm or NDC)
    code = statement.medicationCodeableConcept.coding?.[0]?.code;
  }
  // If reference is used instead, get the Medication resource
  else if (statement.medicationReference?.reference) {
    const medication = getMedicationFromReference(bundle, statement.medicationReference.reference);

    if (medication) {
      // Use text if available
      if (medication.code?.text) {
        display = medication.code.text;
      }
      // Otherwise use display from coding
      else if (medication.code?.coding?.[0]?.display) {
        display = medication.code.coding[0].display;
      }

      // Get code (rxNorm or NDC)
      code = medication.code?.coding?.[0]?.code;
    }
  }

  return { display, code };
};

/**
 * Extracts display text and code for a medication from Zus data
 */
const getZusMedicationInfo = (
  statement: MedicationStatement
): { display: string; code?: string } => {
  let display = "Unknown medication";
  let code;

  if (statement.medicationCodeableConcept) {
    // Use text if available
    if (statement.medicationCodeableConcept.text) {
      display = statement.medicationCodeableConcept.text;
    }
    // Otherwise use display from coding
    else if (statement.medicationCodeableConcept.coding?.[0]?.display) {
      display = statement.medicationCodeableConcept.coding[0].display;
    }

    // Get code (rxNorm or NDC)
    code = statement.medicationCodeableConcept.coding?.[0]?.code;
  }

  return { display, code };
};

/**
 * Gets the date from a medication statement
 */
const getMedicationDate = (statement: MedicationStatement): string | undefined => {
  // Check effectivePeriod first
  if (statement.effectivePeriod?.start) {
    return statement.effectivePeriod.start;
  }

  if (statement.effectivePeriod?.end) {
    return statement.effectivePeriod.end;
  }

  // Try effectiveDateTime as fallback
  return statement.effectiveDateTime;
};

/**
 * Determines if two medications are similar based on display text, code, and date
 */
const areMedicationsSimilar = (med1: MedicationInfo, med2: MedicationInfo): boolean => {
  // If codes are available and match, it's definitely the same medication
  if (med1.code && med2.code && med1.code === med2.code) {
    return true;
  }

  // Create normalized versions of display text for comparison
  const normalizeText = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

  const display1 = normalizeText(med1.display);
  const display2 = normalizeText(med2.display);

  // If display texts are very similar, consider them a match
  if (display1 === display2) {
    return true;
  }

  // If one is a substring of the other (with some flexibility)
  if (display1.includes(display2) || display2.includes(display1)) {
    return true;
  }

  // If dates match exactly and display texts are somewhat similar
  if (med1.date && med2.date && med1.date === med2.date) {
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
 * Removes duplicate medications by keeping only one entry for each unique code and date combination
 */
const removeDuplicateMedications = (medications: MedicationInfo[]): MedicationInfo[] => {
  // Use a Map to track unique medications by code and date
  const uniqueMedicationsMap = new Map<string, MedicationInfo>();

  medications.forEach(medication => {
    // Create a key using code and date
    const code = medication.code || "unknown";
    const date = medication.date || "unknown";
    const key = `${code}:${date}`;

    // Only add if we haven't seen this key before
    if (!uniqueMedicationsMap.has(key)) {
      uniqueMedicationsMap.set(key, medication);
    }
  });

  // Convert map values back to array
  return Array.from(uniqueMedicationsMap.values());
};

/**
 * Extracts display text and code from a MedicationDispense resource
 */
const getMedicationDispenseInfo = (
  dispense: MedicationDispense,
  bundle: Bundle
): { display: string; code?: string; date?: string } => {
  let display = "Unknown medication";
  let code;

  // First try to get info from medicationCodeableConcept
  if (dispense.medicationCodeableConcept) {
    if (dispense.medicationCodeableConcept.text) {
      display = dispense.medicationCodeableConcept.text;
    } else if (dispense.medicationCodeableConcept.coding?.[0]?.display) {
      display = dispense.medicationCodeableConcept.coding[0].display;
    }

    // Get code (rxNorm or NDC)
    code = dispense.medicationCodeableConcept.coding?.[0]?.code;
  }
  // If reference is used instead, get the Medication resource
  else if (dispense.medicationReference?.reference) {
    const medication = getMedicationFromReference(bundle, dispense.medicationReference.reference);

    if (medication) {
      if (medication.code?.text) {
        display = medication.code.text;
      } else if (medication.code?.coding?.[0]?.display) {
        display = medication.code.coding[0].display;
      }

      code = medication.code?.coding?.[0]?.code;
    }
  }

  // Get the date from relevant fields
  const date = dispense.whenHandedOver ?? dispense.whenPrepared;

  return { display, code, date };
};

/**
 * Extracts display text and code from a MedicationAdministration resource
 */
const getMedicationAdministrationInfo = (
  admin: MedicationAdministration,
  bundle: Bundle
): { display: string; code?: string; date?: string } => {
  let display = "Unknown medication";
  let code;
  let date;

  // First try to get info from medicationCodeableConcept
  if (admin.medicationCodeableConcept) {
    if (admin.medicationCodeableConcept.text) {
      display = admin.medicationCodeableConcept.text;
    } else if (admin.medicationCodeableConcept.coding?.[0]?.display) {
      display = admin.medicationCodeableConcept.coding[0].display;
    }

    // Get code (rxNorm or NDC)
    code = admin.medicationCodeableConcept.coding?.[0]?.code;
  }
  // If reference is used instead, get the Medication resource
  else if (admin.medicationReference?.reference) {
    const medication = getMedicationFromReference(bundle, admin.medicationReference.reference);

    if (medication) {
      if (medication.code?.text) {
        display = medication.code.text;
      } else if (medication.code?.coding?.[0]?.display) {
        display = medication.code.coding[0].display;
      }

      code = medication.code?.coding?.[0]?.code;
    }
  }

  // Get the date from relevant fields
  if (admin.effectiveDateTime) {
    date = admin.effectiveDateTime;
  } else if (admin.effectivePeriod?.start) {
    date = admin.effectivePeriod.start;
  } else if (admin.effectivePeriod?.end) {
    date = admin.effectivePeriod.end;
  }

  return { display, code, date };
};

/**
 * Determines if a medication is from the last year
 */
const isMedicationFromLastYear = (medication: MedicationInfo): boolean => {
  if (!medication.date) return false;
  const medicationDate = dayjs(medication.date);
  const lastYearDate = dayjs().subtract(1, "year");
  return medicationDate.isAfter(lastYearDate);
};

/**
 * Processes medications from both Metriport and Zus bundles
 */
export const processMedications = (
  metriportBundle?: Bundle,
  zusBundle?: Bundle
): MedicationSummary => {
  // Process Metriport medications
  const metriportMedicationsRaw: MedicationInfo[] = [];
  if (metriportBundle?.entry) {
    metriportBundle.entry.forEach(entry => {
      const resource = entry.resource;

      if (!resource) return;

      // Process MedicationStatement resources
      if (resource.resourceType === "MedicationStatement" && !shouldFilterResource(resource)) {
        const statement = resource as MedicationStatement;
        const { display, code } = getMetriportMedicationInfo(statement, metriportBundle);

        metriportMedicationsRaw.push({
          display,
          date: getMedicationDate(statement),
          code,
          source: "Metriport",
        });
      }
    });
  }

  // Process Zus medications
  const zusMedicationsRaw: MedicationInfo[] = [];
  if (zusBundle?.entry) {
    zusBundle.entry.forEach(entry => {
      const resource = entry.resource;

      if (!resource || shouldFilterResource(resource)) return;

      // Process MedicationStatement resources
      if (resource.resourceType === "MedicationStatement") {
        const statement = resource as MedicationStatement;
        const { display, code } = getZusMedicationInfo(statement);

        zusMedicationsRaw.push({
          display,
          date: getMedicationDate(statement),
          code,
          source: "Zus",
        });
      }
      // Process MedicationDispense resources
      else if (resource.resourceType === "MedicationDispense") {
        const dispense = resource as MedicationDispense;
        const { display, code, date } = getMedicationDispenseInfo(dispense, zusBundle);

        zusMedicationsRaw.push({
          display,
          date,
          code,
          source: "Zus",
        });
      }
      // Process MedicationAdministration resources
      else if (resource.resourceType === "MedicationAdministration") {
        const admin = resource as MedicationAdministration;
        const { display, code, date } = getMedicationAdministrationInfo(admin, zusBundle);

        zusMedicationsRaw.push({
          display,
          date,
          code,
          source: "Zus",
        });
      }
    });
  }

  // Remove duplicates within each source
  const metriportMedications = removeDuplicateMedications(metriportMedicationsRaw);
  const zusMedications = removeDuplicateMedications(zusMedicationsRaw);

  const uniqueToMetriportMedications = [];
  const metriportMedicationsInLastYear = [];

  const uniqueToZusMedications = [];
  const zusMedicationsInLastYear = [];

  let commonCount = 0;

  // Process Metriport medications
  for (const metriportMedication of metriportMedications) {
    // Check if from last year
    if (isMedicationFromLastYear(metriportMedication)) {
      metriportMedicationsInLastYear.push(metriportMedication);
    }

    // Check if unique or common
    const isUnique = !zusMedications.some(zusMedication =>
      areMedicationsSimilar(metriportMedication, zusMedication)
    );

    if (isUnique) {
      uniqueToMetriportMedications.push(metriportMedication);
    } else {
      commonCount++;
    }
  }

  // Process Zus medications
  for (const zusMedication of zusMedications) {
    // Check if from last year
    if (isMedicationFromLastYear(zusMedication)) {
      zusMedicationsInLastYear.push(zusMedication);
    }

    // Check if unique
    const isUnique = !metriportMedications.some(metriportMedication =>
      areMedicationsSimilar(metriportMedication, zusMedication)
    );

    if (isUnique) {
      uniqueToZusMedications.push(zusMedication);
    }
  }

  return {
    metriport: {
      count: metriportMedications.length,
      medications: metriportMedications,
      medicationsInLastYear: metriportMedicationsInLastYear,
      uniqueCount: uniqueToMetriportMedications.length,
      uniqueMedications: uniqueToMetriportMedications,
    },
    zus: {
      count: zusMedications.length,
      medications: zusMedications,
      medicationsInLastYear: zusMedicationsInLastYear,
      uniqueCount: uniqueToZusMedications.length,
      uniqueMedications: uniqueToZusMedications,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Formats the medication summary in a question-answer format
 */
export const formatMedicationSummary = (summary: MedicationSummary): string => {
  let result = "";
  const currentDate = new Date();
  const lastYearDate = new Date();
  lastYearDate.setFullYear(currentDate.getFullYear() - 1);

  // Filter medications from the last year
  const lastYearMetriportMedications = summary.metriport.medications.filter(med => {
    if (!med.date) return false;
    const medDate = new Date(med.date);
    return medDate >= lastYearDate;
  });

  const lastYearZusMedications = summary.zus.medications.filter(med => {
    if (!med.date) return false;
    const medDate = new Date(med.date);
    return medDate >= lastYearDate;
  });

  // Calculate totals and differences
  const lastYearMetriportCount = lastYearMetriportMedications.length;
  const lastYearZusCount = lastYearZusMedications.length;
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  // Determine which source had more medications in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Determine which source had more medications in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the results as questions and answers
  result += "### Comparing Medications between Metriport and Zus\n\n";

  result += `**Which source had more medications in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of medications (${lastYearMetriportCount}) in the last year.\n\n`;
  } else {
    result += `${moreLastYear} had more medications in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;
  }

  result += `**Which source had more medications in total?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of medications (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more total medications (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique medications from both sources
  result += `**Medications unique to each source:**\n\n`;

  // Show unique Metriport medications
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} medications that were not found in Zus:**\n\n`;
    const uniqueMetriportMedicationsByYear = groupMedicationsByYear(
      summary.metriport.uniqueMedications
    );
    result += formatMedicationsByYear(uniqueMetriportMedicationsByYear);
  } else {
    result += `**Metriport had no unique medications (all matched in Zus)**\n\n`;
  }

  // Show unique Zus medications
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} medications that were not found in Metriport:**\n\n`;
    const uniqueZusMedicationsByYear = groupMedicationsByYear(summary.zus.uniqueMedications);
    result += formatMedicationsByYear(uniqueZusMedicationsByYear);
  } else {
    result += `**Zus had no unique medications (all matched in Metriport)**\n\n`;
  }

  result += `**Common medications found in both sources: ${summary.common.count}**\n\n`;

  return result;
};

/**
 * Groups medications by year and sorts them in descending order by date
 */
const groupMedicationsByYear = (
  medications: MedicationInfo[]
): Record<string, MedicationInfo[]> => {
  // Sort medications by date (most recent first)
  const sortedMedications = [...medications].sort((a, b) => {
    // If no dates are available, keep original order
    if (!a.date && !b.date) return 0;
    // Items with no date go last
    if (!a.date) return 1;
    if (!b.date) return -1;
    // Sort descending by date
    return b.date.localeCompare(a.date);
  });

  const medicationsByYear: Record<string, MedicationInfo[]> = {};

  sortedMedications.forEach(medication => {
    let year = "Unknown";

    if (medication.date) {
      // Extract year from ISO date string (YYYY-MM-DD or YYYY)
      const match = medication.date.match(/^(\d{4})/);
      if (match) {
        year = match[1];
      }
    }

    if (!medicationsByYear[year]) {
      medicationsByYear[year] = [];
    }

    medicationsByYear[year].push(medication);
  });

  return medicationsByYear;
};

/**
 * Formats medications grouped by year
 */
const formatMedicationsByYear = (medicationsByYear: Record<string, MedicationInfo[]>): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(medicationsByYear).sort((a, b) => {
    // "Unknown" year should be last
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    // Otherwise, sort years in descending order
    return b.localeCompare(a);
  });

  years.forEach(year => {
    const yearMedications = medicationsByYear[year];
    result += `### ${year} (${yearMedications.length})\n\n`;

    yearMedications.forEach(medication => {
      const dateDisplay = medication.date ? ` (${medication.date})` : "";
      const codeDisplay = medication.code ? ` [${medication.code}]` : "";
      result += `- ${medication.display}${codeDisplay}${dateDisplay}\n`;
    });

    result += "\n";
  });

  return result;
};
