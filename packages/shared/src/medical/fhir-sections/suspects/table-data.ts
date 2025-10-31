import { SectionKey } from "..";
import { Suspect, exampleSuspects } from "./shared";

export type SuspectRowData = {
  id: string;
  condition: string;
  code: string;
  documented: string;
};

/**
 * The whole Table for only for demo purposes
 */
export function suspectTableData() {
  return {
    key: "suspects" as SectionKey,
    rowData: getSuspectRowData(getSuspectsAndRelatedResources()),
  };
}

function getSuspectsAndRelatedResources(): Suspect[] {
  return exampleSuspects;
}

function getSuspectRowData(suspects: Suspect[]): SuspectRowData[] {
  return suspects?.flatMap(suspect => {
    return {
      id: suspect.id,
      condition: suspect.condition,
      code: suspect.code,
      documented: suspect.documented,
    };
  });
}
