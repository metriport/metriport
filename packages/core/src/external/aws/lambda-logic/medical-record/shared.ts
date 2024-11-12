import { Bundle, Resource, ResourceType } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import { createNotesSections } from "./sections/notes/section";
import { createConditionsSections } from "./sections/conditions/section";
import { createMedicationsSections } from "./sections/medications/section";
import { createAllergiesSections } from "./sections/allergies/section";
import { createProceduresSections } from "./sections/procedures/section";
import { createSocialHistorySections } from "./sections/social-histroy/section";
import { createVitalsSections } from "./sections/vitals/section";
import { createLabsSections } from "./sections/labs/section";
import { createObservationsSections } from "./sections/observations/section";
import { createImmunizationsSections } from "./sections/immunizations/section";
import { createFamilyHistorySections } from "./sections/family-history/section";
import { createRelatedPersonsSections } from "./sections/related-persons/section";
import { createCoveragesSections } from "./sections/coverages/section";
import { createEncountersSections } from "./sections/encounters/section";

export const ISO_DATE = "YYYY-MM-DD";

export enum FilterSectionsKeys {
  notes = "notes",
  conditions = "conditions",
  medications = "medications",
  allergies = "allergies",
  procedures = "procedures",
  socialHistory = "socialHistory",
  vitals = "vitals",
  labs = "labs",
  observations = "observations",
  immunizations = "immunizations",
  familyMemberHistories = "familyHistory",
  relatedPersons = "relatedPersons",
  coverages = "coverages",
  encounters = "encounters",
}

export interface Filter {
  key: FilterSectionsKeys;
  customTitle?: string;
  dateFilter?: {
    quantity?: string;
    unit?: dayjs.UnitTypeLong;
  };
  stringFilter?: string;
}

export type ResourceMap = {
  [resourceId: string]: Resource;
};

export type MappedConsolidatedResources = {
  [resourceType: string]: ResourceMap;
};

export const defaultFilters: Filter[] = [
  { key: FilterSectionsKeys.notes },
  { key: FilterSectionsKeys.conditions },
  { key: FilterSectionsKeys.medications },
  { key: FilterSectionsKeys.allergies },
  { key: FilterSectionsKeys.procedures },
  { key: FilterSectionsKeys.socialHistory },
  { key: FilterSectionsKeys.vitals },
  { key: FilterSectionsKeys.labs },
  { key: FilterSectionsKeys.observations },
  { key: FilterSectionsKeys.immunizations },
  { key: FilterSectionsKeys.familyMemberHistories },
  { key: FilterSectionsKeys.relatedPersons },
  { key: FilterSectionsKeys.coverages },
  { key: FilterSectionsKeys.encounters },
];

export const filterToComponentMap: {
  [key in FilterSectionsKeys]: (
    mappedResources: MappedConsolidatedResources,
    filters: Filter
  ) => string;
} = {
  [FilterSectionsKeys.notes]: createNotesSections,
  [FilterSectionsKeys.conditions]: createConditionsSections,
  [FilterSectionsKeys.medications]: createMedicationsSections,
  [FilterSectionsKeys.allergies]: createAllergiesSections,
  [FilterSectionsKeys.procedures]: createProceduresSections,
  [FilterSectionsKeys.socialHistory]: createSocialHistorySections,
  [FilterSectionsKeys.vitals]: createVitalsSections,
  [FilterSectionsKeys.labs]: createLabsSections,
  [FilterSectionsKeys.observations]: createObservationsSections,
  [FilterSectionsKeys.immunizations]: createImmunizationsSections,
  [FilterSectionsKeys.familyMemberHistories]: createFamilyHistorySections,
  [FilterSectionsKeys.relatedPersons]: createRelatedPersonsSections,
  [FilterSectionsKeys.coverages]: createCoveragesSections,
  [FilterSectionsKeys.encounters]: createEncountersSections,
};

export function formatDateForDisplay(date: Date): string;
export function formatDateForDisplay(date?: string | undefined): string;
export function formatDateForDisplay(date?: Date | string | undefined): string {
  const dateStr = typeof date === "string" ? date : date?.toISOString();
  return dateStr ? dayjs(dateStr).format(ISO_DATE) : "";
}

export function groupSectionsByFhirResource(fhirBundle: Bundle): MappedConsolidatedResources {
  if (!fhirBundle.entry) {
    throw new Error("No entries found in bundle");
  }

  const mappedResources: MappedConsolidatedResources = {};

  fhirBundle.entry?.forEach(entry => {
    const resource = entry.resource;
    if (resource) {
      if (!mappedResources[resource.resourceType]) {
        mappedResources[resource.resourceType] = {};
      }

      const mappedResource = mappedResources[resource.resourceType];

      if (mappedResource && resource.id) {
        mappedResource[resource.id] = resource;
      }
    }
  });

  return mappedResources;
}

export function getResourcesFromBundle<Resource>(
  bundle: MappedConsolidatedResources | undefined,
  resourceType: ResourceType
): Resource[] {
  if (!bundle) {
    return [];
  }

  const resourceMap = bundle[resourceType];

  if (!resourceMap) {
    return [];
  }

  return Object.values(resourceMap) as Resource[];
}

export function getResourceFromBundle<Resource>(
  bundle: MappedConsolidatedResources | undefined,
  resourceType: ResourceType,
  resourceId: string | undefined
): Resource | undefined {
  if (!bundle || !resourceId) {
    return undefined;
  }

  const resourceMap = bundle[resourceType];

  if (!resourceMap) {
    return undefined;
  }

  return resourceMap[resourceId] as Resource;
}
