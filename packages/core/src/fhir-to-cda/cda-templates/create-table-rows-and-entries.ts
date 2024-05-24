import { Resource } from "@medplum/fhirtypes";
import { toArray } from "@metriport/shared";
import {
  CreateEntriesCallback,
  CreateTableRowsCallback,
  TableRowsAndEntriesResult,
} from "../cda-types/shared-types";
import { AugmentedResource } from "./components/augmented-resources";

export function createTableRowsAndEntries<R extends Resource, T extends AugmentedResource<R>, X>(
  augObs: T[],
  tableRowsCallback: CreateTableRowsCallback<T>,
  entriesCallback: CreateEntriesCallback<T, X>
): TableRowsAndEntriesResult<X> {
  const result: TableRowsAndEntriesResult<X> = {
    trs: [],
    entries: [],
  };

  augObs.map((aug, index) => {
    const sectionPrefix = `${aug.sectionName}${index + 1}`;
    const trs = tableRowsCallback(aug, sectionPrefix);
    const trsEntries = toArray(trs);
    const entries = entriesCallback(aug, sectionPrefix);
    const entriesArray = toArray(entries);

    result.trs.push(...trsEntries);
    result.entries.push(...entriesArray);
  });
  return result;
}
