import {
  CreateEntriesCallback,
  CreateTableRowsCallback,
  TableRowsAndEntriesResult,
} from "../cda-types/shared-types";
import { AugmentedResource } from "./components/augmented-resources";
import { wrapInArray } from "@metriport/shared";

export function createTableRowsAndEntries<T extends AugmentedResource>(
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
    const entries = entriesCallback(aug, sectionPrefix);
    const entriesArray = wrapInArray(entries);

    result.trs.push(...trs);
    result.entries.push(...entriesArray);
  });
  return result;
}
