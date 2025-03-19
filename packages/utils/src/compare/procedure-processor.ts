import { Bundle, Procedure } from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";
import dayjs from "dayjs";

/**
 * Represents a procedure with its display information
 */
interface ProcedureInfo {
  display: string;
  date?: string;
  source: "Metriport" | "Zus";
}

/**
 * Represents the summary of procedures by source
 */
interface ProcedureSummary {
  metriport: {
    count: number;
    procedures: ProcedureInfo[];
    proceduresInLastYear: ProcedureInfo[];
    uniqueCount: number;
    uniqueProcedures: ProcedureInfo[];
  };
  zus: {
    count: number;
    procedures: ProcedureInfo[];
    proceduresInLastYear: ProcedureInfo[];
    uniqueCount: number;
    uniqueProcedures: ProcedureInfo[];
  };
  common: {
    count: number;
  };
}

/**
 * Extracts display text for a procedure from Metriport data
 */
const getMetriportProcedureDisplay = (procedure: Procedure): string => {
  // Try to get text from code.text first
  if (procedure.code?.text) {
    return procedure.code.text;
  }

  // Try to get from coding display
  if (procedure.code?.coding?.some(coding => coding.display)) {
    const displayCoding = procedure.code.coding.find(coding => coding.display);
    return displayCoding?.display ?? "Unknown procedure";
  }

  return "Unknown procedure";
};

/**
 * Extracts display text for a procedure from Zus data
 */
const getZusProcedureDisplay = (procedure: Procedure): string => {
  // Try to get text from code.text first
  if (procedure.code?.text) {
    return procedure.code.text;
  }

  // Try to get from coding display
  if (procedure.code?.coding?.some(coding => coding.display)) {
    const displayCoding = procedure.code.coding.find(coding => coding.display);
    return displayCoding?.display ?? "Unknown procedure";
  }

  // Try to get from note text
  if (procedure.note?.length && procedure.note[0].text) {
    // Extract the first line or first part until a newline or period
    const noteText = procedure.note[0].text;
    const firstLine = noteText.split(/[\n\r.]/)[0].trim();
    return firstLine || "Unknown procedure";
  }

  return "Unknown procedure";
};

/**
 * Gets the date from a procedure
 */
const getProcedureDate = (procedure: Procedure): string | undefined => {
  // Check performedDateTime first
  if (procedure.performedDateTime) {
    return procedure.performedDateTime;
  }

  // Check performedPeriod if available
  if (procedure.performedPeriod?.start) {
    return procedure.performedPeriod.start;
  }

  return undefined;
};

/**
 * Determines if two procedures are similar based on display text and date
 */
const areProceduresSimilar = (procedure1: ProcedureInfo, procedure2: ProcedureInfo): boolean => {
  // Create normalized versions of display text for comparison
  const normalizeText = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

  const display1 = normalizeText(procedure1.display);
  const display2 = normalizeText(procedure2.display);

  // If display texts are very similar, consider them a match
  if (display1 === display2) {
    return true;
  }

  // If one is a substring of the other (with some flexibility)
  if (display1.includes(display2) || display2.includes(display1)) {
    return true;
  }

  // If dates match exactly and display texts are somewhat similar
  if (procedure1.date && procedure2.date && procedure1.date === procedure2.date) {
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
 * Determines if a procedure is from the last year
 */
const isProcedureFromLastYear = (procedure: ProcedureInfo): boolean => {
  if (!procedure.date) return false;
  const procedureDate = dayjs(procedure.date);
  const lastYearDate = dayjs().subtract(1, "year");
  return procedureDate.isAfter(lastYearDate);
};

/**
 * Processes procedures from both Metriport and Zus bundles
 */
export const processProcedures = (
  metriportBundle?: Bundle,
  zusBundle?: Bundle
): ProcedureSummary => {
  const metriportProcedures = metriportBundle
    ? metriportBundle.entry
        ?.filter(
          entry =>
            entry.resource?.resourceType === "Procedure" && !shouldFilterResource(entry.resource)
        )
        .map(entry => {
          const procedure = entry.resource as Procedure;
          return {
            display: getMetriportProcedureDisplay(procedure),
            date: getProcedureDate(procedure),
            source: "Metriport" as const,
          };
        }) ?? []
    : [];

  const zusProcedures = zusBundle
    ? zusBundle.entry
        ?.filter(
          entry =>
            entry.resource?.resourceType === "Procedure" && !shouldFilterResource(entry.resource)
        )
        .map(entry => {
          const procedure = entry.resource as Procedure;
          return {
            display: getZusProcedureDisplay(procedure),
            date: getProcedureDate(procedure),
            source: "Zus" as const,
          };
        }) ?? []
    : [];

  const uniqueToMetriportProcedures = [];
  const metriportProceduresInLastYear = [];

  const uniqueToZusProcedures = [];
  const zusProceduresInLastYear = [];

  let commonCount = 0;

  // Process Metriport procedures
  for (const metriportProcedure of metriportProcedures) {
    // Check if from last year
    if (isProcedureFromLastYear(metriportProcedure)) {
      metriportProceduresInLastYear.push(metriportProcedure);
    }

    // Check if unique or common
    const isUnique = !zusProcedures.some(zusProcedure =>
      areProceduresSimilar(metriportProcedure, zusProcedure)
    );

    if (isUnique) {
      uniqueToMetriportProcedures.push(metriportProcedure);
    } else {
      commonCount++;
    }
  }

  // Process Zus procedures
  for (const zusProcedure of zusProcedures) {
    // Check if from last year
    if (isProcedureFromLastYear(zusProcedure)) {
      zusProceduresInLastYear.push(zusProcedure);
    }

    // Check if unique
    const isUnique = !metriportProcedures.some(metriportProcedure =>
      areProceduresSimilar(metriportProcedure, zusProcedure)
    );

    if (isUnique) {
      uniqueToZusProcedures.push(zusProcedure);
    }
  }

  return {
    metriport: {
      count: metriportProcedures.length,
      procedures: metriportProcedures,
      proceduresInLastYear: metriportProceduresInLastYear,
      uniqueCount: uniqueToMetriportProcedures.length,
      uniqueProcedures: uniqueToMetriportProcedures,
    },
    zus: {
      count: zusProcedures.length,
      procedures: zusProcedures,
      proceduresInLastYear: zusProceduresInLastYear,
      uniqueCount: uniqueToZusProcedures.length,
      uniqueProcedures: uniqueToZusProcedures,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Formats the procedure summary in a question-answer format
 */
export const formatProcedureSummary = (summary: ProcedureSummary): string => {
  let result = "";
  const currentDate = new Date();
  const lastYearDate = new Date();
  lastYearDate.setFullYear(currentDate.getFullYear() - 1);

  // Filter procedures from the last year
  const lastYearMetriportProcedures = summary.metriport.procedures.filter(procedure => {
    if (!procedure.date) return false;
    const procedureDate = new Date(procedure.date);
    return procedureDate >= lastYearDate;
  });

  const lastYearZusProcedures = summary.zus.procedures.filter(procedure => {
    if (!procedure.date) return false;
    const procedureDate = new Date(procedure.date);
    return procedureDate >= lastYearDate;
  });

  // Calculate totals and differences
  const lastYearMetriportCount = lastYearMetriportProcedures.length;
  const lastYearZusCount = lastYearZusProcedures.length;
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  // Determine which source had more procedures in the last year
  const moreLastYear =
    lastYearMetriportCount > lastYearZusCount
      ? "Metriport"
      : lastYearZusCount > lastYearMetriportCount
      ? "Zus"
      : "Equal";

  // Determine which source had more procedures in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the results as questions and answers
  result += "### Comparing Procedures between Metriport and Zus\n\n";

  result += `**Which source had more procedures in the last year?**\n`;
  if (moreLastYear === "Equal") {
    result += `Both sources had the same number of procedures (${lastYearMetriportCount}) in the last year.\n\n`;
  } else {
    result += `${moreLastYear} had more procedures in the last year (${
      moreLastYear === "Metriport" ? lastYearMetriportCount : lastYearZusCount
    } vs ${moreLastYear === "Metriport" ? lastYearZusCount : lastYearMetriportCount}).\n\n`;
  }

  result += `**Which source had more procedures in total?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of procedures (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more total procedures (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique procedures from both sources
  result += `**Procedures unique to each source:**\n\n`;

  // Show unique Metriport procedures
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} procedures that were not found in Zus:**\n\n`;
    const uniqueMetriportProceduresByYear = groupProceduresByYear(
      summary.metriport.uniqueProcedures
    );
    result += formatProceduresByYear(uniqueMetriportProceduresByYear);
  } else {
    result += `**Metriport had no unique procedures (all matched in Zus)**\n\n`;
  }

  // Show unique Zus procedures
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} procedures that were not found in Metriport:**\n\n`;
    const uniqueZusProceduresByYear = groupProceduresByYear(summary.zus.uniqueProcedures);
    result += formatProceduresByYear(uniqueZusProceduresByYear);
  } else {
    result += `**Zus had no unique procedures (all matched in Metriport)**\n\n`;
  }

  result += `**Common procedures found in both sources: ${summary.common.count}**\n\n`;

  return result;
};

/**
 * Groups procedures by year and sorts them in descending order by date
 */
const groupProceduresByYear = (procedures: ProcedureInfo[]): Record<string, ProcedureInfo[]> => {
  // Sort procedures by date (most recent first)
  const sortedProcedures = [...procedures].sort((a, b) => {
    // If no dates are available, keep original order
    if (!a.date && !b.date) return 0;
    // Items with no date go last
    if (!a.date) return 1;
    if (!b.date) return -1;
    // Sort descending by date
    return b.date.localeCompare(a.date);
  });

  const proceduresByYear: Record<string, ProcedureInfo[]> = {};

  sortedProcedures.forEach(procedure => {
    let year = "Unknown";

    if (procedure.date) {
      // Extract year from ISO date string (YYYY-MM-DD or YYYY)
      const match = procedure.date.match(/^(\d{4})/);
      if (match) {
        year = match[1];
      }
    }

    if (!proceduresByYear[year]) {
      proceduresByYear[year] = [];
    }

    proceduresByYear[year].push(procedure);
  });

  return proceduresByYear;
};

/**
 * Formats procedures grouped by year
 */
const formatProceduresByYear = (proceduresByYear: Record<string, ProcedureInfo[]>): string => {
  let result = "";

  // Get years in descending order
  const years = Object.keys(proceduresByYear).sort((a, b) => {
    // "Unknown" year should be last
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    // Otherwise, sort years in descending order
    return b.localeCompare(a);
  });

  years.forEach(year => {
    const yearProcedures = proceduresByYear[year];
    result += `### ${year} (${yearProcedures.length})\n\n`;

    yearProcedures.forEach(procedure => {
      const dateDisplay = procedure.date ? ` (${procedure.date})` : "";
      result += `- ${procedure.display}${dateDisplay}\n`;
    });

    result += "\n";
  });

  return result;
};
