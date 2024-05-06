import { AugmentedResource } from "./components/augmented-resources";
import { CreateEntriesCallback, CreateTableRowsCallback, TableRowsAndEntriesResult } from "./types";

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
    result.trs.push(...trs);
    result.entries.push(...entries);
  });
  return result;
}
