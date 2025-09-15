import { CodeableConcept, Condition, Extension, Patient } from "@medplum/fhirtypes";
import { ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  getFirstCodeSpecified,
  getResourcesFromBundle,
  getValidCode,
  MappedConsolidatedResources,
  SectionKey,
} from "..";
import { ICD_10_CODE, SNOMED_CODE } from "../../index";

dayjs.extend(utc);

const CHRONICITY_EXTENSION_URL = "http://hl7.org/fhir/StructureDefinition/condition-related";
const HCC_EXTENSION_URL = `https://public.metriport.com/fhir/StructureDefinition/condition-hcc.json`;

export type ConditionRowData = {
  id: string;
  condition: string;
  code: string;
  firstSeen: string;
  lastSeen: string;
  originalData: Condition;
  ehrAction?: string;
  isChronic: boolean;
  isHcc: boolean;
};

type ConditionOccurrence = {
  rawCondition: Condition;
  start: string | undefined;
  end: string | undefined;
  status: string | undefined;
};

export type GroupedConditions = {
  title: string;
  mostRecentCondition: Condition;
  sortedOccurrences?: ConditionOccurrence[];
  status?: string | undefined;
};

export function conditionTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const patient = getResourcesFromBundle<Patient>(bundle, "Patient")[0];
  const patientDob = patient?.birthDate ? dayjs.utc(patient.birthDate).format(ISO_DATE) : undefined;
  const conditions = getResourcesFromBundle<Condition>(bundle, "Condition");
  const groupedConditions = groupConditions(conditions, patientDob);
  const fullRowData = getConditionRowData({ conditions: groupedConditions, patientDob });
  return { key: "conditions" as SectionKey, rowData: fullRowData };
}

export function groupConditions(
  conditions: Condition[],
  patientDob: string | undefined
): GroupedConditions[] {
  const results: GroupedConditions[] = [];
  const conditionMap: {
    [k: string]: {
      rawCondition: Condition;
      start: string | undefined;
      end: string | undefined;
      status: string | undefined;
    }[];
  } = {};
  conditions.map(c => {
    let title: string;
    const codings = getValidCode(c.code?.coding);
    const displays = codings.map(coding => coding.display);
    const text = c.code?.text;
    if (displays.length) {
      title = Array.from(new Set(displays)).join(", ");
    } else if (text) {
      title = text;
    } else {
      results.push({ title: "-", mostRecentCondition: c });
      return;
    }
    if (!c.onsetPeriod && !c.onsetDateTime) {
      results.push({ title, mostRecentCondition: c });
      return;
    }

    const conditionPoint = {
      rawCondition: c,
      start: getOnsetTime(c, patientDob),
      end: c.onsetPeriod?.end ? dayjs(c.onsetPeriod.end).format(ISO_DATE) : undefined,
      status: getStatus(c),
    };
    const groupedCondition = conditionMap[title];
    if (groupedCondition) {
      groupedCondition.push(conditionPoint);
    } else {
      conditionMap[title] = [conditionPoint];
    }
  });

  Object.entries(conditionMap).map(([title, values]) => {
    const sortedOccurrences = values.sort((a, b) => {
      const dateA = a.start ? new Date(a.start).getTime() : 0;
      const dateB = b.start ? new Date(b.start).getTime() : 0;

      return dateB - dateA;
    });
    const mostRecent = sortedOccurrences[0];
    if (!mostRecent) return;
    results.push({
      title,
      mostRecentCondition: mostRecent.rawCondition,
      sortedOccurrences,
      status: mostRecent.status,
    });
  });
  return results;
}

export function getStatus(condition: Condition): string | undefined {
  return condition.clinicalStatus?.text ??
    condition.clinicalStatus?.coding?.[0]?.display ??
    condition.clinicalStatus?.coding?.[0]?.code === "55561003"
    ? "Active"
    : condition.clinicalStatus?.coding?.[0]?.code;
}

function getConditionRowData({
  conditions,
  patientDob,
}: {
  conditions: GroupedConditions[];
  patientDob: string | undefined;
}): ConditionRowData[] {
  return conditions.map(condition => {
    const mostRecentCondition = condition.mostRecentCondition;

    return {
      id: mostRecentCondition.id ?? "-",
      condition: condition.title,
      code: getConditionCode(mostRecentCondition) + getConditionHccCode(mostRecentCondition),
      firstSeen: getEarliestSeen(condition.sortedOccurrences, patientDob),
      lastSeen: getOnsetTime(mostRecentCondition) ?? "",
      originalData: mostRecentCondition,
      isChronic: isChronicCondition(mostRecentCondition),
      isHcc: isHccCondition(mostRecentCondition),
    };
  });
}

export function getConditionCode(condition: Condition): string {
  const coding = getFirstCodeSpecified(condition.code?.coding ?? [], [ICD_10_CODE, SNOMED_CODE]);

  return coding ? `${coding.system}: ${coding.code}` : "-";
}

export function getOnsetTime(
  condition: Condition,
  patientDob?: string | undefined
): string | undefined {
  const onsetDateTime = condition.onsetDateTime;
  const onsetPeriodStart = condition.onsetPeriod?.start;
  const onsetPeriodEnd = condition.onsetPeriod?.end;

  const time = onsetDateTime || onsetPeriodStart || onsetPeriodEnd;

  if (time) {
    const date = dayjs.utc(time).format(ISO_DATE);
    if (patientDob && (date === patientDob || patientDob === "Invalid Date")) return undefined;

    return date;
  }

  return undefined;
}

function getEarliestSeen(
  occurrences: ConditionOccurrence[] | undefined,
  patientDob: string | undefined
): string {
  const earliest = occurrences?.reduce((acc, curr) => {
    if (!acc || (curr.start && acc.start && new Date(curr.start) < new Date(acc.start))) {
      if (curr.start != patientDob) {
        return curr;
      }
    }
    return acc;
  }, null as ConditionOccurrence | null);

  return earliest?.start ?? "-";
}

export function isChronicCondition(condition?: Condition): boolean {
  if (!condition) return false;
  const chronicityExtension = condition.extension?.find(
    (e: Extension) => e.url === CHRONICITY_EXTENSION_URL
  );
  return chronicityExtension?.valueCoding?.code === "C" ? true : false;
}

function isHccExtension(extension: Extension): boolean {
  return extension.url === HCC_EXTENSION_URL;
}

function createHccExtension(
  url: string,
  system: string,
  display: string,
  version: string,
  code: string
): Extension {
  return {
    url,
    valueCodeableConcept: { coding: [{ system, display, version, code }] },
  };
}

function buildUniqueHccExtention(extensions: Extension[]): Extension[] {
  const hccExtensions = extensions.filter(isHccExtension);
  if (!hccExtensions?.length) return [];
  // Group extensions by display name
  const groupedByDisplay = new Map<string, Extension[]>();
  hccExtensions.forEach(extension => {
    const coding = extension.valueCodeableConcept?.coding?.[0];
    if (!coding?.display) return;

    if (!groupedByDisplay.has(coding.display)) {
      groupedByDisplay.set(coding.display, []);
    }
    groupedByDisplay.get(coding.display)?.push(extension);
  });

  // Combine extensions with same display name
  const result: Extension[] = [];
  groupedByDisplay.forEach((extensionsGroup, display) => {
    if (extensionsGroup.length === 1) {
      // Single extension, ensure it has the consolidated format
      const extension = extensionsGroup[0];
      if (!extension || !extension.url) return;

      const coding = extension.valueCodeableConcept?.coding?.[0];
      if (coding?.code && coding?.version) {
        const consolidatedExtension = createHccExtension(
          extension.url,
          coding.system ?? "",
          display,
          coding.version,
          `${coding.code} (${coding.version})`
        );
        result.push(consolidatedExtension);
      } else {
        // Fallback to original if missing version info
        result.push(extension);
      }
    } else {
      // Multiple extensions with same display, combine them
      const firstExtension = extensionsGroup[0];
      if (!firstExtension || !firstExtension.url) return;

      const allCodings = extensionsGroup
        .map(ext => ext.valueCodeableConcept?.coding?.[0])
        .filter((coding): coding is NonNullable<typeof coding> => !!coding);

      // Combine versions and codes
      const versions = allCodings.map(c => c.version).filter((v): v is string => !!v);
      const codes = allCodings
        .map(c => (c.code && c.version ? `${c.code} (${c.version})` : ""))
        .filter(Boolean);

      const combinedExtension = createHccExtension(
        firstExtension.url,
        firstExtension.valueCodeableConcept?.coding?.[0]?.system ?? "",
        display,
        versions.join(", "),
        codes.join(", ")
      );

      result.push(combinedExtension);
    }
  });

  return result;
}

export function getConditionHccCode(condition?: Condition): string {
  if (!condition?.extension?.length) return "";
  const consolidatedExtensions = buildUniqueHccExtention(condition.extension);
  if (!consolidatedExtensions.length) return "";
  const result = consolidatedExtensions
    .map(e => {
      const coding = e.valueCodeableConcept?.coding?.[0];
      return coding?.code ? coding.code : "";
    })
    .filter(Boolean)
    .join(", ");

  return result !== "" ? `; HCC: ${result}` : "";
}

export function isHccCondition(condition?: Condition): boolean {
  return !!condition?.extension?.find(isHccExtension);
}

export function getHccCoditionsForSidePanel(condition?: Condition): CodeableConcept[] {
  if (!condition?.extension?.length) return [];
  const consolidatedExtensions = buildUniqueHccExtention(condition.extension);
  return consolidatedExtensions
    .map(e => e.valueCodeableConcept)
    .filter(Boolean) as CodeableConcept[];
}
