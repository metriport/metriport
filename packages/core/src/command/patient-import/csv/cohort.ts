import { filterTruthy } from "@metriport/shared/common/filter-map";
import { isValidUuid } from "@metriport/shared/util/uuid-v7";
import { ParsingError } from "./shared";

const maxCohorts = 10;

/**
 * Maps a record/map of CSV patient data to cohort IDs.
 *
 * NOTE: when parsing columns, csv-parser populates them in lower-case, so
 * the property names are all lower-case.
 *
 * @param csvPatient - The CSV patient data.
 * @returns The cohort IDs with errors indicated on the errors array.
 */
export function mapCsvCohorts(csvPatient: Record<string, string | undefined>): {
  cohortIds: string[] | undefined;
  errors: ParsingError[];
} {
  const errors: ParsingError[] = [];
  const cohortIds: (string | undefined)[] = [];

  const { cohortId, errors: errorsNoIdx } = parseCohort(csvPatient, undefined);
  cohortIds.push(cohortId);
  errors.push(...errorsNoIdx);

  for (let i = 1; i <= maxCohorts; i++) {
    const { cohortId, errors: errorsIdx } = parseCohort(csvPatient, i);
    cohortIds.push(cohortId);
    errors.push(...errorsIdx);
  }

  const filteredCohortIds = cohortIds.flatMap(filterTruthy);
  return {
    cohortIds: filteredCohortIds.length > 0 ? filteredCohortIds : undefined,
    errors,
  };
}

function parseCohort(
  csvPatient: Record<string, string | undefined>,
  index: number | undefined
): { cohortId: string | undefined; errors: ParsingError[] } {
  const errors: ParsingError[] = [];
  const indexSuffix = index ? `-${index}` : "";
  const cohortName = `cohort${indexSuffix}`;
  const cohortNameLower = cohortName.toLowerCase();

  const cohortIdRaw = csvPatient[cohortNameLower]?.trim();
  if (!cohortIdRaw || cohortIdRaw.length < 1) {
    return { cohortId: undefined, errors };
  }

  if (!isValidUuid(cohortIdRaw)) {
    errors.push({
      field: cohortName,
      error: `Invalid cohort ID (must be a valid UUID)`,
    });
    return { cohortId: undefined, errors };
  }

  return { cohortId: cohortIdRaw, errors };
}
