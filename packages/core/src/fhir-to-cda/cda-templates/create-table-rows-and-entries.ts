import { Resource } from "@medplum/fhirtypes";
import { wrapInArray } from "@metriport/shared";
import {
  CreateEntriesCallback,
  CreateTableRowsCallback,
  ObservationTableRow,
  TableRowsAndEntriesResult,
} from "../cda-types/shared-types";
import { AugmentedResource } from "./components/augmented-resources";

export function createTableRowsAndEntries<R extends Resource, T extends AugmentedResource<R>>(
  augObs: T[],
  tableRowsCallback: CreateTableRowsCallback<T>,
  entriesCallback: CreateEntriesCallback<T>
): TableRowsAndEntriesResult {
  const result: TableRowsAndEntriesResult = {
    trs: [],
    entries: [],
  };

  augObs.map((aug, index) => {
    const sectionPrefix = `${aug.sectionName}${index + 1}`;
    const trs = tableRowsCallback(aug, sectionPrefix);
    const trsEntries = wrapInArray(trs) as ObservationTableRow[];
    const entries = entriesCallback(aug, sectionPrefix);
    const entriesArray = wrapInArray(entries);

    result.trs.push(...trsEntries);
    result.entries.push(...entriesArray);
  });
  return result;
}
