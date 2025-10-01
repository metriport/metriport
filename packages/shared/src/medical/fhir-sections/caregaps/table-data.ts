import { CareGap, exampleCareGaps } from "./dummy-sample";
import { SectionKey } from "..";

export type CareGapRowData = {
  id: string;
  name: string;
  description: string;
  code: string;
};

/**
 * The whole Table for only for demo purposes
 */
export function careGapTableData() {
  return {
    key: "caregaps" as SectionKey,
    rowData: getCareGapRowData(getCareGapsAndRelatedResources()),
  };
}

function getCareGapsAndRelatedResources(): CareGap[] {
  return exampleCareGaps;
}

function getCareGapRowData(careGaps: CareGap[]): CareGapRowData[] {
  return careGaps?.flatMap(careGap => {
    return {
      id: careGap.id,
      name: careGap.name,
      description: careGap.description,
      code: careGap.code,
    };
  });
}
