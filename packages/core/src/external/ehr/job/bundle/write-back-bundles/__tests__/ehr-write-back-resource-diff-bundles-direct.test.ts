import { Condition, DiagnosticReport, Observation, Resource } from "@medplum/fhirtypes";
import { WriteBackFiltersPerResourceType } from "@metriport/shared/interface/external/ehr/shared";
import {
  normalizeDiagnosticReportCoding,
  shouldWriteBackResource,
  skipConditionChronicity,
  skipLabDate,
  skipLabLoincCode,
  skipLabNonTrending,
  skipLabPanelDate,
  skipLabPanelLoincCode,
  skipLabPanelNonTrending,
  skipVitalDate,
  skipVitalLoinCode,
} from "../ehr-write-back-resource-diff-bundles-direct";
import {
  chronicCondition,
  chronicityFilterAll,
  chronicityFilterChronic,
  chronicityFilterNonChronic,
  chronicityFilterUndefined,
  labDateFilterOn20240101,
  labDateFilterOn20250101,
  labDateFilterUndefined,
  labDateObservationOn20240101,
  labDateObservationPre20240101,
  labLoincCodeObservationCode1,
  labLoincCodeObservationCode2,
  labLoincCodeObservationCode2Duplicate,
  labLoincCodesFilterCode1,
  labLoincCodesFilterCode2,
  labLoincCodesFilterUndefined,
  labMinCountPerCodeFilterMin1,
  labMinCountPerCodeFilterMin2,
  labMinCountPerCodeFilterUndefined,
  labPanelDateFilterOn20240101,
  labPanelDateFilterOn20250101,
  labPanelDateFilterUndefined,
  labPanelDateObservationOn20240101,
  labPanelDateObservationPre20240101,
  labPanelLoincCodeObservationCode1,
  labPanelLoincCodeObservationCode2,
  labPanelLoincCodeObservationCode2Duplicate,
  labPanelLoincCodesFilterCode,
  labPanelLoincCodesFilterCode1,
  labPanelLoincCodesFilterCode2,
  labPanelLoincCodesFilterUndefined,
  labPanelMinCountPerCodeFilterMin1,
  labPanelMinCountPerCodeFilterMin2,
  labPanelMinCountPerCodeFilterUndefined,
  labReportOtherCodeDiagnosticReportCode,
  labReportOtherCodeDisplay2,
  nonChronicCondition,
  unknownChronicityCondition,
  vitalDateFilterPost20240101,
  vitalDateFilterPost20250101,
  vitalDateFilterUndefined,
  vitalDateObservationOn20240101,
  vitalDateObservationPre20240101,
  vitalLoincCodeObservationCode1,
  vitalLoincCodeObservationCode2,
  vitalLoincCodesFilterCode1,
  vitalLoincCodesFilterCode2,
  vitalLoincCodesFilterUndefined,
} from "./consts";

const fixedDate = new Date("2025-01-01T00:00:00Z");

function compareResources(resources: Resource[], expectedResources: Resource[]) {
  const resourceIds = resources.map(resource => resource.id);
  const expectedResourceIds = expectedResources.map(resource => resource.id);
  expect(resourceIds.sort()).toEqual(expectedResourceIds.sort());
}

describe("write-back-resource-diff-bundles-direct", () => {
  describe("skipConditionChronicity", () => {
    const unfilteredResources = [chronicCondition, nonChronicCondition, unknownChronicityCondition];

    it("should keep chronic conditions", () => {
      const filteredResources: Condition[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipConditionChronicity(
          resource as Condition,
          chronicityFilterChronic as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Condition);
      }
      compareResources(filteredResources, [chronicCondition] as Condition[]);
    });
    it("should keep non-chronic conditions", () => {
      const filteredResources: Condition[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipConditionChronicity(
          resource as Condition,
          chronicityFilterNonChronic as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Condition);
      }
      compareResources(filteredResources, [
        nonChronicCondition,
        unknownChronicityCondition,
      ] as Condition[]);
    });
    it("should keep all conditions when chronicityFilter is all", () => {
      const filteredResources: Condition[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipConditionChronicity(
          resource as Condition,
          chronicityFilterAll as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Condition);
      }
      compareResources(filteredResources, unfilteredResources as Condition[]);
    });
    it("should keep all conditions when chronicityFilter is not set", () => {
      const filteredResources: Condition[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipConditionChronicity(
          resource as Condition,
          chronicityFilterUndefined as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Condition);
      }
      compareResources(filteredResources, unfilteredResources as Condition[]);
    });
  });
  describe("skipLabDate", () => {
    const unfilteredResources = [labDateObservationPre20240101, labDateObservationOn20240101];

    it("should keep observations after or on 2024-01-01", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabDate(
          resource as Observation,
          labDateFilterOn20240101 as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [labDateObservationOn20240101] as Observation[]);
    });
    it("should keep no observations", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabDate(
          resource as Observation,
          labDateFilterOn20250101 as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, []);
    });
    it("should keep both observations when relativeRange is not set", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabDate(
          resource as Observation,
          labDateFilterUndefined as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, unfilteredResources as Observation[]);
    });
  });
  describe("skipLabLoincCode", () => {
    const unfilteredResources = [labLoincCodeObservationCode1, labLoincCodeObservationCode2];

    it("should keep observations with loinc code 1", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabLoincCode(
          resource as Observation,
          labLoincCodesFilterCode1 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [labLoincCodeObservationCode1] as Observation[]);
    });
    it("should keep observations with loinc code 2", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabLoincCode(
          resource as Observation,
          labLoincCodesFilterCode2 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [labLoincCodeObservationCode2] as Observation[]);
    });
    it("should keep both observations when loincCodes is not set", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabLoincCode(
          resource as Observation,
          labLoincCodesFilterUndefined as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, unfilteredResources as Observation[]);
    });
  });
  describe("skipLabNonTrending", () => {
    const unfilteredResources = [
      labLoincCodeObservationCode1,
      labLoincCodeObservationCode2,
      labLoincCodeObservationCode2Duplicate,
    ];

    it("should keep observation with loinc code 1 when minCountPerCode is 1", () => {
      const filteredResources: Observation[] = [];
      for (const resource of [labLoincCodeObservationCode1]) {
        const shouldSkip = skipLabNonTrending(
          resource as Observation,
          unfilteredResources as Observation[],
          labMinCountPerCodeFilterMin1 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [labLoincCodeObservationCode1] as Observation[]);
    });
    it("should keep not observation with loinc code 1 when minCountPerCode is 2", () => {
      const filteredResources: Observation[] = [];
      for (const resource of [labLoincCodeObservationCode1]) {
        const shouldSkip = skipLabNonTrending(
          resource as Observation,
          unfilteredResources as Observation[],
          labMinCountPerCodeFilterMin2 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, []);
    });
    it("should keep observation with loinc code 2 when minCountPerCode is 1", () => {
      const filteredResources: Observation[] = [];
      for (const resource of [labLoincCodeObservationCode2]) {
        const shouldSkip = skipLabNonTrending(
          resource as Observation,
          unfilteredResources as Observation[],
          labMinCountPerCodeFilterMin1 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [labLoincCodeObservationCode2] as Observation[]);
    });
    it("should keep observation with loinc code 2 when minCountPerCode is 2", () => {
      const filteredResources: Observation[] = [];
      for (const resource of [labLoincCodeObservationCode2]) {
        const shouldSkip = skipLabNonTrending(
          resource as Observation,
          unfilteredResources as Observation[],
          labMinCountPerCodeFilterMin2 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [labLoincCodeObservationCode2] as Observation[]);
    });
    it("should keep both all observations when minCountPerCode is undefined", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabNonTrending(
          resource as Observation,
          unfilteredResources as Observation[],
          labMinCountPerCodeFilterUndefined as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, unfilteredResources as Observation[]);
    });
  });
  describe("skipLabPanelDate", () => {
    const unfilteredResources = [
      labPanelDateObservationPre20240101,
      labPanelDateObservationOn20240101,
    ];

    it("should keep diagnostic reports after or on 2024-01-01", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabPanelDate(
          resource as DiagnosticReport,
          labPanelDateFilterOn20240101 as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, [
        labPanelDateObservationOn20240101,
      ] as DiagnosticReport[]);
    });
    it("should keep no diagnostic reports", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabPanelDate(
          resource as DiagnosticReport,
          labPanelDateFilterOn20250101 as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, []);
    });
    it("should keep both diagnostic reports when relativeRange is not set", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabPanelDate(
          resource as DiagnosticReport,
          labPanelDateFilterUndefined as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, unfilteredResources as DiagnosticReport[]);
    });
  });

  describe("keep fitting code display, if matches loinc", () => {
    it("should keep observations with a display that matches a loinc code", () => {
      const unfilteredResources: DiagnosticReport[] = [
        labReportOtherCodeDiagnosticReportCode as DiagnosticReport,
      ];
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const normalizedResource = normalizeDiagnosticReportCoding(resource);
        const shouldSkip = skipLabPanelLoincCode(
          normalizedResource as DiagnosticReport,
          labPanelLoincCodesFilterCode as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(normalizedResource as DiagnosticReport);
      }
      compareResources(filteredResources, [
        labReportOtherCodeDiagnosticReportCode,
      ] as DiagnosticReport[]);
    });

    it("should remove observations with a display that doesn't match a loinc code", () => {
      const labOtherCodeDiagnosticReportCode2 = {
        ...labReportOtherCodeDiagnosticReportCode,
        code: {
          coding: [
            {
              ...labReportOtherCodeDiagnosticReportCode.code.coding[0],
              display: labReportOtherCodeDisplay2,
            },
          ],
        },
      };

      const unfilteredResources: DiagnosticReport[] = [
        labOtherCodeDiagnosticReportCode2 as DiagnosticReport,
      ];
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const normalizedResource = normalizeDiagnosticReportCoding(resource);
        const shouldSkip = skipLabPanelLoincCode(
          normalizedResource as DiagnosticReport,
          labPanelLoincCodesFilterCode as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(normalizedResource as DiagnosticReport);
      }
      compareResources(filteredResources, [] as DiagnosticReport[]);
    });
  });
  describe("skipLabPanelLoincCode", () => {
    const unfilteredResources = [
      labPanelLoincCodeObservationCode1,
      labPanelLoincCodeObservationCode2,
    ];

    it("should keep diagnostic reports with loinc code 1", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabPanelLoincCode(
          resource as DiagnosticReport,
          labPanelLoincCodesFilterCode1 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, [
        labPanelLoincCodeObservationCode1,
      ] as DiagnosticReport[]);
    });
    it("should keep diagnostic reports with loinc code 2", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabPanelLoincCode(
          resource as DiagnosticReport,
          labPanelLoincCodesFilterCode2 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, [
        labPanelLoincCodeObservationCode2,
      ] as DiagnosticReport[]);
    });
    it("should keep both diagnostic reports when loincCodes is not set", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabPanelLoincCode(
          resource as DiagnosticReport,
          labPanelLoincCodesFilterUndefined as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, unfilteredResources as DiagnosticReport[]);
    });
  });
  describe("skipLabPanelNonTrending", () => {
    const unfilteredResources = [
      labPanelLoincCodeObservationCode1,
      labPanelLoincCodeObservationCode2,
      labPanelLoincCodeObservationCode2Duplicate,
    ];

    it("should keep diagnostic report with loinc code 1 when minCountPerCode is 1", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of [labPanelLoincCodeObservationCode1]) {
        const shouldSkip = skipLabPanelNonTrending(
          resource as DiagnosticReport,
          unfilteredResources as DiagnosticReport[],
          labPanelMinCountPerCodeFilterMin1 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, [
        labPanelLoincCodeObservationCode1,
      ] as DiagnosticReport[]);
    });
    it("should keep not diagnostic report with loinc code 1 when minCountPerCode is 2", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of [labPanelLoincCodeObservationCode1]) {
        const shouldSkip = skipLabPanelNonTrending(
          resource as DiagnosticReport,
          unfilteredResources as DiagnosticReport[],
          labPanelMinCountPerCodeFilterMin2 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, []);
    });
    it("should keep diagnostic report with loinc code 2 when minCountPerCode is 1", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of [labPanelLoincCodeObservationCode2]) {
        const shouldSkip = skipLabPanelNonTrending(
          resource as DiagnosticReport,
          unfilteredResources as DiagnosticReport[],
          labPanelMinCountPerCodeFilterMin1 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, [
        labPanelLoincCodeObservationCode2,
      ] as DiagnosticReport[]);
    });
    it("should keep diagnostic report with loinc code 2 when minCountPerCode is 2", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of [labPanelLoincCodeObservationCode2]) {
        const shouldSkip = skipLabPanelNonTrending(
          resource as DiagnosticReport,
          unfilteredResources as DiagnosticReport[],
          labPanelMinCountPerCodeFilterMin2 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, [
        labPanelLoincCodeObservationCode2,
      ] as DiagnosticReport[]);
    });
    it("should keep both all observations when minCountPerCode is undefined", () => {
      const filteredResources: DiagnosticReport[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipLabPanelNonTrending(
          resource as DiagnosticReport,
          unfilteredResources as DiagnosticReport[],
          labPanelMinCountPerCodeFilterUndefined as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as DiagnosticReport);
      }
      compareResources(filteredResources, unfilteredResources as DiagnosticReport[]);
    });
  });
  describe("skipVitalDate", () => {
    const unfilteredResources = [vitalDateObservationPre20240101, vitalDateObservationOn20240101];

    it("should keep observations after or on 2024-01-01", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipVitalDate(
          resource as Observation,
          vitalDateFilterPost20240101 as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [vitalDateObservationOn20240101] as Observation[]);
    });
    it("should keep no observations", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipVitalDate(
          resource as Observation,
          vitalDateFilterPost20250101 as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, []);
    });
    it("should keep both observations when relativeRange is not set", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipVitalDate(
          resource as Observation,
          vitalDateFilterUndefined as WriteBackFiltersPerResourceType,
          fixedDate
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, unfilteredResources as Observation[]);
    });
  });
  describe("skipVitalLoinCode", () => {
    const unfilteredResources = [vitalLoincCodeObservationCode1, vitalLoincCodeObservationCode2];

    it("should keep observations with loinc code 1", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipVitalLoinCode(
          resource as Observation,
          vitalLoincCodesFilterCode1 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [vitalLoincCodeObservationCode1] as Observation[]);
    });

    it("should keep observations with loinc code 2", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipVitalLoinCode(
          resource as Observation,
          vitalLoincCodesFilterCode2 as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [vitalLoincCodeObservationCode2] as Observation[]);
    });

    it("should keep both observations when loincCodes is not set", () => {
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldSkip = skipVitalLoinCode(
          resource as Observation,
          vitalLoincCodesFilterUndefined as WriteBackFiltersPerResourceType
        );
        if (!shouldSkip) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, unfilteredResources as Observation[]);
    });
  });
  describe("shouldWriteBackResource", () => {
    it("should keep condition when chronicityFilter is set", () => {
      const unfilteredResources = [
        chronicCondition,
        nonChronicCondition,
        unknownChronicityCondition,
      ];
      const filteredResources: Condition[] = [];
      for (const resource of unfilteredResources) {
        const shouldKeep = shouldWriteBackResource({
          resource: resource as Condition,
          resources: unfilteredResources as Condition[],
          writeBackResourceType: "condition",
          writeBackFilters: chronicityFilterChronic as WriteBackFiltersPerResourceType,
        });
        if (shouldKeep) filteredResources.push(resource as Condition);
      }
      compareResources(filteredResources, [chronicCondition] as Condition[]);
    });
    it("should keep lab when dateFilter is set", () => {
      const unfilteredResources = [labDateObservationPre20240101, labDateObservationOn20240101];
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldKeep = shouldWriteBackResource({
          resource: resource as Observation,
          resources: unfilteredResources as Observation[],
          writeBackResourceType: "lab",
          writeBackFilters: labDateFilterUndefined as WriteBackFiltersPerResourceType,
        });
        if (shouldKeep) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, unfilteredResources as Observation[]);
    });
    it("should keep lab when loincCodeFilter is set", () => {
      const unfilteredResources = [labLoincCodeObservationCode1, labLoincCodeObservationCode2];
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldKeep = shouldWriteBackResource({
          resource: resource as Observation,
          resources: unfilteredResources as Observation[],
          writeBackResourceType: "lab",
          writeBackFilters: labLoincCodesFilterCode1 as WriteBackFiltersPerResourceType,
        });
        if (shouldKeep) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [labLoincCodeObservationCode1] as Observation[]);
    });
    it("should keep lab when minCountPerCodeFilter is set", () => {
      const unfilteredResources = [
        labLoincCodeObservationCode1,
        labLoincCodeObservationCode2,
        labLoincCodeObservationCode2Duplicate,
      ];
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldKeep = shouldWriteBackResource({
          resource: resource as Observation,
          resources: unfilteredResources as Observation[],
          writeBackResourceType: "lab",
          writeBackFilters: labMinCountPerCodeFilterMin2 as WriteBackFiltersPerResourceType,
        });
        if (shouldKeep) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [
        labLoincCodeObservationCode2,
        labLoincCodeObservationCode2Duplicate,
      ] as Observation[]);
    });
    it("should keep vital when dateFilter is set", () => {
      const unfilteredResources = [vitalDateObservationPre20240101, vitalDateObservationOn20240101];
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldKeep = shouldWriteBackResource({
          resource: resource as Observation,
          resources: unfilteredResources as Observation[],
          writeBackResourceType: "grouped-vitals",
          writeBackFilters: vitalDateFilterUndefined as WriteBackFiltersPerResourceType,
        });
        if (shouldKeep) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, unfilteredResources as Observation[]);
    });
    it("should keep vital when loincCodeFilter is set", () => {
      const unfilteredResources = [vitalLoincCodeObservationCode1, vitalLoincCodeObservationCode2];
      const filteredResources: Observation[] = [];
      for (const resource of unfilteredResources) {
        const shouldKeep = shouldWriteBackResource({
          resource: resource as Observation,
          resources: unfilteredResources as Observation[],
          writeBackResourceType: "grouped-vitals",
          writeBackFilters: vitalLoincCodesFilterCode1 as WriteBackFiltersPerResourceType,
        });
        if (shouldKeep) filteredResources.push(resource as Observation);
      }
      compareResources(filteredResources, [vitalLoincCodeObservationCode1] as Observation[]);
    });
  });
});
