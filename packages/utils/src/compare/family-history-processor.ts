import { Bundle, FamilyMemberHistory } from "@medplum/fhirtypes";
import { shouldFilterResource } from "./filter-utils";

/**
 * Represents a family member history item with its display information
 */
interface FamilyHistoryInfo {
  relation: string;
  conditions: string[];
  source: "Metriport" | "Zus";
}

/**
 * Represents the summary of family history by source
 */
interface FamilyHistorySummary {
  metriport: {
    count: number;
    familyHistories: FamilyHistoryInfo[];
    uniqueCount: number;
    uniqueFamilyHistories: FamilyHistoryInfo[];
  };
  zus: {
    count: number;
    familyHistories: FamilyHistoryInfo[];
    uniqueCount: number;
    uniqueFamilyHistories: FamilyHistoryInfo[];
  };
  common: {
    count: number;
  };
}

/**
 * Extracts relationship display text from a FamilyMemberHistory
 */
const getRelationshipDisplay = (familyHistory: FamilyMemberHistory): string => {
  // Try to get text from relationship.text first
  if (familyHistory.relationship?.text) {
    return familyHistory.relationship.text;
  }

  // Try to get from relationship coding display
  if (familyHistory.relationship?.coding?.some(coding => coding.display)) {
    const displayCoding = familyHistory.relationship.coding.find(coding => coding.display);
    return displayCoding?.display ?? "Unknown relation";
  }

  // Fallback to code
  if (familyHistory.relationship?.coding?.some(coding => coding.code)) {
    const codeCoding = familyHistory.relationship.coding.find(coding => coding.code);
    return codeCoding?.code ?? "Unknown relation";
  }

  return "Unknown relation";
};

/**
 * Extracts condition texts from Metriport FamilyMemberHistory
 */
const getMetriportConditions = (familyHistory: FamilyMemberHistory): string[] => {
  const conditions: string[] = [];

  familyHistory.condition?.forEach(condition => {
    let conditionText = "Unknown condition";

    // Try to get text from code.text first
    if (condition.code?.text) {
      conditionText = condition.code.text;
    }
    // Try to get from coding display
    else if (condition.code?.coding?.some(coding => coding.display)) {
      const displayCoding = condition.code.coding.find(coding => coding.display);
      conditionText = displayCoding?.display ?? "Unknown condition";
    }
    // Fallback to code
    else if (condition.code?.coding?.some(coding => coding.code)) {
      const codeCoding = condition.code.coding.find(coding => coding.code);
      conditionText = codeCoding?.code ?? "Unknown condition";
    }

    conditions.push(conditionText);
  });

  return conditions;
};

/**
 * Extracts condition texts from Zus FamilyMemberHistory (from notes)
 */
const getZusConditions = (familyHistory: FamilyMemberHistory): string[] => {
  const conditions: string[] = [];

  if (familyHistory.note?.length) {
    familyHistory.note.forEach(note => {
      if (note.text) {
        // Some notes may contain multiple conditions separated by commas or newlines
        const noteLines = note.text.split(/[,\n\r]+/).map(line => line.trim());
        noteLines.forEach(line => {
          if (line) {
            conditions.push(line);
          }
        });
      }
    });
  }

  // Also check condition array like Metriport if available
  if (familyHistory.condition?.length) {
    familyHistory.condition.forEach(condition => {
      let conditionText = "Unknown condition";

      // Try to get text from code.text first
      if (condition.code?.text) {
        conditionText = condition.code.text;
      }
      // Try to get from coding display
      else if (condition.code?.coding?.some(coding => coding.display)) {
        const displayCoding = condition.code.coding.find(coding => coding.display);
        conditionText = displayCoding?.display ?? "Unknown condition";
      }
      // Fallback to code
      else if (condition.code?.coding?.some(coding => coding.code)) {
        const codeCoding = condition.code.coding.find(coding => coding.code);
        conditionText = codeCoding?.code ?? "Unknown condition";
      }

      conditions.push(conditionText);
    });
  }

  return conditions;
};

/**
 * Processes family history from a Metriport bundle
 */
const processMetriportFamilyHistory = (bundle: Bundle): FamilyHistoryInfo[] => {
  const familyHistories: FamilyHistoryInfo[] = [];
  let resourceCount = 0;
  let filteredCount = 0;

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;

    if (resource?.resourceType !== "FamilyMemberHistory") {
      return;
    }

    resourceCount++;

    if (shouldFilterResource(resource)) {
      filteredCount++;
      return;
    }

    const familyHistory = resource as FamilyMemberHistory;
    const relation = getRelationshipDisplay(familyHistory);
    const conditions = getMetriportConditions(familyHistory);

    familyHistories.push({
      relation,
      conditions,
      source: "Metriport",
    });
  });

  console.log(
    `Metriport: Found ${resourceCount} FamilyMemberHistory resources, filtered ${filteredCount}`
  );
  return familyHistories;
};

/**
 * Processes family history from a Zus bundle
 */
const processZusFamilyHistory = (bundle: Bundle): FamilyHistoryInfo[] => {
  const familyHistories: FamilyHistoryInfo[] = [];
  let resourceCount = 0;
  let filteredCount = 0;

  bundle.entry?.forEach(entry => {
    const resource = entry.resource;

    if (resource?.resourceType !== "FamilyMemberHistory") {
      return;
    }

    resourceCount++;

    if (shouldFilterResource(resource)) {
      filteredCount++;
      return;
    }

    const familyHistory = resource as FamilyMemberHistory;
    const relation = getRelationshipDisplay(familyHistory);
    const conditions = getZusConditions(familyHistory);

    familyHistories.push({
      relation,
      conditions,
      source: "Zus",
    });
  });

  console.log(
    `Zus: Found ${resourceCount} FamilyMemberHistory resources, filtered ${filteredCount}`
  );
  return familyHistories;
};

/**
 * Determines if two family histories are similar based on relation and conditions
 */
const areFamilyHistoriesSimilar = (
  history1: FamilyHistoryInfo,
  history2: FamilyHistoryInfo
): boolean => {
  // Create normalized versions of relation for comparison
  const normalizeText = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

  const relation1 = normalizeText(history1.relation);
  const relation2 = normalizeText(history2.relation);

  // If relations are not similar, they're not the same family member
  if (relation1 !== relation2 && !relation1.includes(relation2) && !relation2.includes(relation1)) {
    return false;
  }

  // If both have conditions, check for overlap
  if (history1.conditions.length > 0 && history2.conditions.length > 0) {
    // Normalize all conditions
    const normalizedConditions1 = history1.conditions.map(c => normalizeText(c));
    const normalizedConditions2 = history2.conditions.map(c => normalizeText(c));

    console.log(
      `Comparing conditions: ${JSON.stringify(normalizedConditions1)} vs ${JSON.stringify(
        normalizedConditions2
      )}`
    );

    // Check if any conditions are similar
    for (const condition1 of normalizedConditions1) {
      for (const condition2 of normalizedConditions2) {
        if (
          condition1 === condition2 ||
          condition1.includes(condition2) ||
          condition2.includes(condition1)
        ) {
          return true;
        }
      }
    }
  }

  // If they have the same relation but no matching conditions, still consider them similar
  // since we're primarily matching on the family member relation
  return true;
};

/**
 * Processes family history from both Metriport and Zus bundles
 */
export const processFamilyHistory = (
  metriportBundle?: Bundle,
  zusBundle?: Bundle
): FamilyHistorySummary => {
  if (!metriportBundle?.entry?.length && !zusBundle?.entry?.length) {
    console.log("Warning: Both bundles are empty or undefined");
  }

  const metriportFamilyHistories = metriportBundle
    ? processMetriportFamilyHistory(metriportBundle)
    : [];

  const zusFamilyHistories = zusBundle ? processZusFamilyHistory(zusBundle) : [];

  console.log(
    `Extracted ${metriportFamilyHistories.length} Metriport and ${zusFamilyHistories.length} Zus histories`
  );

  const uniqueToMetriportFamilyHistories = [];

  const uniqueToZusFamilyHistories = [];

  let commonCount = 0;

  // Process Metriport family histories
  for (const metriportHistory of metriportFamilyHistories) {
    // Check if unique or common
    const isUnique = !zusFamilyHistories.some(zusHistory =>
      areFamilyHistoriesSimilar(metriportHistory, zusHistory)
    );

    if (isUnique) {
      uniqueToMetriportFamilyHistories.push(metriportHistory);
    } else {
      commonCount++;
    }
  }

  // Process Zus family histories
  for (const zusHistory of zusFamilyHistories) {
    // Check if unique
    const isUnique = !metriportFamilyHistories.some(metriportHistory =>
      areFamilyHistoriesSimilar(metriportHistory, zusHistory)
    );

    if (isUnique) {
      uniqueToZusFamilyHistories.push(zusHistory);
    }
  }

  return {
    metriport: {
      count: metriportFamilyHistories.length,
      familyHistories: metriportFamilyHistories,
      uniqueCount: uniqueToMetriportFamilyHistories.length,
      uniqueFamilyHistories: uniqueToMetriportFamilyHistories,
    },
    zus: {
      count: zusFamilyHistories.length,
      familyHistories: zusFamilyHistories,
      uniqueCount: uniqueToZusFamilyHistories.length,
      uniqueFamilyHistories: uniqueToZusFamilyHistories,
    },
    common: {
      count: commonCount,
    },
  };
};

/**
 * Formats the family history summary in a question-answer format
 */
export const formatFamilyHistorySummary = (summary: FamilyHistorySummary): string => {
  let result = "";

  // Calculate totals
  const totalMetriportCount = summary.metriport.count;
  const totalZusCount = summary.zus.count;

  // Determine which source had more family history records in total
  const moreTotal =
    totalMetriportCount > totalZusCount
      ? "Metriport"
      : totalZusCount > totalMetriportCount
      ? "Zus"
      : "Equal";

  // Format the results as questions and answers
  result += "### Comparing Family History between Metriport and Zus\n\n";

  result += `**Which source had more family history records?**\n`;
  if (moreTotal === "Equal") {
    result += `Both sources had the same number of family history records (${totalMetriportCount}).\n\n`;
  } else {
    result += `${moreTotal} had more family history records (${
      moreTotal === "Metriport" ? totalMetriportCount : totalZusCount
    } vs ${moreTotal === "Metriport" ? totalZusCount : totalMetriportCount}).\n\n`;
  }

  // Always show unique family history from both sources
  result += `**Family history unique to each source:**\n\n`;

  // Show unique Metriport family history
  if (summary.metriport.uniqueCount > 0) {
    result += `**Metriport had ${summary.metriport.uniqueCount} family history records that were not found in Zus:**\n\n`;
    result += formatFamilyHistories(summary.metriport.uniqueFamilyHistories);
  } else {
    result += `**Metriport had no unique family history records (all matched in Zus)**\n\n`;
  }

  // Show unique Zus family history
  if (summary.zus.uniqueCount > 0) {
    result += `**Zus had ${summary.zus.uniqueCount} family history records that were not found in Metriport:**\n\n`;
    result += formatFamilyHistories(summary.zus.uniqueFamilyHistories);
  } else {
    result += `**Zus had no unique family history records (all matched in Metriport)**\n\n`;
  }

  // Show common family history
  result += `**Common family history found in both sources: ${summary.common.count}**\n\n`;

  return result;
};

/**
 * Formats family history records for display
 */
const formatFamilyHistories = (familyHistories: FamilyHistoryInfo[]): string => {
  let result = "";

  // Group by family relation
  const groupedByRelation: Record<string, FamilyHistoryInfo[]> = {};

  familyHistories.forEach(history => {
    if (!groupedByRelation[history.relation]) {
      groupedByRelation[history.relation] = [];
    }
    groupedByRelation[history.relation].push(history);
  });

  // Format each relation group
  Object.keys(groupedByRelation)
    .sort()
    .forEach(relation => {
      result += `### ${relation}\n\n`;

      // Combine all conditions for this relation
      const allConditions = new Set<string>();
      groupedByRelation[relation].forEach(history => {
        history.conditions.forEach(condition => allConditions.add(condition));
      });

      if (allConditions.size > 0) {
        result += "**Conditions:**\n\n";
        Array.from(allConditions)
          .sort()
          .forEach(condition => {
            result += `- ${condition}\n`;
          });
      } else {
        result += "No specific conditions recorded.\n";
      }

      result += "\n";
    });

  return result;
};
