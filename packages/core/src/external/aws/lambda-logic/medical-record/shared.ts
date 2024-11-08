import dayjs from "dayjs";

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
    from?: string;
    to?: string;
  };
  stringFilter?: string;
}

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

export function formatDateForDisplay(date: Date): string;
export function formatDateForDisplay(date?: string | undefined): string;
export function formatDateForDisplay(date?: Date | string | undefined): string {
  const dateStr = typeof date === "string" ? date : date?.toISOString();
  return dateStr ? dayjs(dateStr).format(ISO_DATE) : "";
}
