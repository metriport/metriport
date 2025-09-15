import { Coding, Reference, Resource, ResourceType } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { ISO_DATE } from "../../common/date";
import { allergyTableData } from "./allergies/table-data";
import { careGapTableData } from "./caregaps/table-data";
import { carePlanTableData } from "./careplans/table-data";
import { conditionTableData } from "./conditions/table-data";
import { coverageTableData } from "./coverages/table-data";
import { buildDocumentTableData } from "./documents/table-data";
import { encounterTableData } from "./encounters/table-data";
import { familyMemberHistoryTableData } from "./family-member-histories/table-data";
import { immunizationTableData } from "./immunizations/table-data";
import { labTableData } from "./labs/table-data";
import { medicationTableData } from "./medications/table-data";
import { observationTableData } from "./observations/table-data";
import { procedureTableData } from "./procedures/table-data";
import { relatedPersonTableData } from "./related-persons/table-data";
import { reportTableData } from "./reports/table-data";
import { socialHistoryTableData } from "./social-history/table-data";
import { suspectTableData } from "./suspects/table-data";
import { vitalTableData } from "./vitals/table-data";

export type ResourceMap = {
  [resourceId: string]: Resource;
};

export type MappedConsolidatedResources = {
  [resourceType: string]: ResourceMap;
};

export type SectionKey =
  | "reports"
  | "conditions"
  | "suspects" // -- dummy section
  | "medications"
  | "allergies"
  | "procedures"
  | "social-history"
  | "vitals"
  | "labs"
  | "observations"
  | "immunizations"
  | "careplans"
  | "caregaps" // -- dummy section
  | "family-member-history"
  | "related-persons"
  | "coverages"
  | "encounters"
  | "documents";

type DummyResourceType = "CareGap" | "Suspect";

export type FhirSectionData = {
  key: SectionKey;
  rowData: object[];
};

export type FhirSection = {
  key: SectionKey;
  resourceType: ResourceType | DummyResourceType;
  generateTableData: (params: { bundle: MappedConsolidatedResources }) => FhirSectionData;
};

export const fhirSections: { [K in SectionKey]?: FhirSection } = {
  reports: {
    resourceType: "DiagnosticReport",
    key: "reports",
    generateTableData: reportTableData,
  },
  conditions: {
    resourceType: "Condition",
    key: "conditions",
    generateTableData: conditionTableData,
  },
  suspects: {
    resourceType: "Suspect",
    key: "suspects",
    generateTableData: suspectTableData,
  },
  medications: {
    resourceType: "Medication",
    key: "medications",
    generateTableData: medicationTableData,
  },
  allergies: {
    resourceType: "AllergyIntolerance",
    key: "allergies",
    generateTableData: allergyTableData,
  },
  procedures: {
    resourceType: "Procedure",
    key: "procedures",
    generateTableData: procedureTableData,
  },
  "social-history": {
    resourceType: "Observation",
    key: "social-history",
    generateTableData: socialHistoryTableData,
  },
  vitals: {
    resourceType: "Observation",
    key: "vitals",
    generateTableData: vitalTableData,
  },
  labs: {
    resourceType: "Observation",
    key: "labs",
    generateTableData: labTableData,
  },
  observations: {
    resourceType: "Observation",
    key: "observations",
    generateTableData: observationTableData,
  },
  immunizations: {
    resourceType: "Immunization",
    key: "immunizations",
    generateTableData: immunizationTableData,
  },
  careplans: {
    resourceType: "CarePlan",
    key: "careplans",
    generateTableData: carePlanTableData,
  },
  caregaps: {
    resourceType: "CareGap",
    key: "caregaps",
    generateTableData: careGapTableData,
  },
  "family-member-history": {
    resourceType: "FamilyMemberHistory",
    key: "family-member-history",
    generateTableData: familyMemberHistoryTableData,
  },
  "related-persons": {
    resourceType: "RelatedPerson",
    key: "related-persons",
    generateTableData: relatedPersonTableData,
  },
  coverages: {
    resourceType: "Coverage",
    key: "coverages",
    generateTableData: coverageTableData,
  },
  encounters: {
    resourceType: "Encounter",
    key: "encounters",
    generateTableData: encounterTableData,
  },
  documents: {
    resourceType: "DocumentReference",
    key: "documents",
    generateTableData: buildDocumentTableData,
  },
};

export type FhirSectionResultData = {
  [K in SectionKey]: { rowData: FhirSectionData[] };
};

function getRosourcesObjectFromBundle(
  bundle: MappedConsolidatedResources,
  resourceType: ResourceType
): ResourceMap | undefined {
  return bundle?.[resourceType];
}

export function getResourcesFromBundle<Resource>(
  bundle: MappedConsolidatedResources | undefined,
  resourceType: ResourceType
): Resource[] {
  if (!bundle) return [];
  const resourceMap = getRosourcesObjectFromBundle(bundle, resourceType);
  if (!resourceMap) return [];
  return Object.values(resourceMap) as Resource[];
}

export function getReferenceResource<Resource>(
  reference: Reference | undefined,
  resourceType: ResourceType,
  bundle: MappedConsolidatedResources | undefined
): Resource | undefined {
  if (!reference || !bundle) return undefined;
  const resourceId = reference.reference?.split("/")[1];
  if (!resourceId) return undefined;
  return getRosourcesObjectFromBundle(bundle, resourceType)?.[resourceId] as Resource;
}

export function getResourceFromBundle<Resource>(
  bundle: MappedConsolidatedResources | undefined,
  resourceType: ResourceType,
  resourceId: string | undefined
): Resource | undefined {
  if (!bundle || !resourceId) return undefined;
  const resourceMap = getRosourcesObjectFromBundle(bundle, resourceType);
  if (!resourceMap) return undefined;
  return resourceMap[resourceId] as Resource;
}

export const UNK_CODE = "UNK";
export const UNKNOWN_DISPLAY = "unknown";

export function getValidCode(coding: Coding[] | undefined): Coding[] {
  if (!coding) return [];

  return coding.filter(coding => {
    return (
      coding.code &&
      coding.code.toLowerCase().trim() !== UNK_CODE.toLowerCase() &&
      coding.display &&
      coding.display.toLowerCase().trim() !== UNKNOWN_DISPLAY
    );
  });
}

type CodeMap = {
  system: string;
  code: string;
  display: string;
};

export function getFirstCodeSpecified(
  coding: Coding[] | undefined,
  systemsList: string[]
): CodeMap | undefined {
  let specifiedCode: CodeMap | undefined = undefined;

  if (systemsList.length && coding) {
    for (const system of systemsList) {
      const obj = coding.find(coding => {
        return coding.system?.toLowerCase().includes(system) && coding.code;
      });

      if (obj) {
        specifiedCode = {
          system: system ? system.toUpperCase() : UNK_CODE,
          code: obj.code ?? UNKNOWN_DISPLAY,
          display: obj.display ?? UNKNOWN_DISPLAY,
        };
        break;
      }
    }
  }

  return specifiedCode;
}

export function formatDate(
  v: string | Date | dayjs.Dayjs | number,
  format = "MMM DD, YYYY"
): string {
  return dayjs(v).format(format);
}

export function bytesToSize(bytes: number) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "n/a";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  if (i === 0) return `${bytes} ${sizes[i]})`;
  return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
}

export function isUnknown(str: string | undefined): boolean {
  return str?.toLowerCase().trim() === "unknown";
}

export function getResourceIdFromReference(reference: string | undefined): string | undefined {
  return reference?.split("/").pop() ?? undefined;
}

export function filterByDate(
  date: string,
  dateFilter?: {
    from?: string;
    to?: string;
  }
) {
  if (dateFilter) {
    const isoDate = dayjs(date, ISO_DATE);
    if (dateFilter.from && isoDate.isBefore(dayjs(dateFilter.from))) {
      return false;
    }
    if (dateFilter.to && isoDate.isAfter(dayjs(dateFilter.to))) {
      return false;
    }
  }

  return true;
}

export function getKnownTitle(str: string | undefined): string | undefined {
  if (!isUnknown(str)) return str;
  return undefined;
}
